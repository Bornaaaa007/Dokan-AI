-- 1) Create a public.users row for every new signup.
--    Only 'customer' or 'seller' is accepted. Admins are set by hand.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (auth_id, name, email, roles)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    new.email,
    case when new.raw_user_meta_data->>'role' = 'seller'
         then array['seller'] else array['customer'] end
  )
  on conflict (auth_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Row Level Security: turn it on everywhere.
--    Your server code and Edge Function use the secret key, which bypasses RLS.
alter table users enable row level security;
alter table shops enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table complaints enable row level security;
alter table badges enable row level security;
alter table search_logs enable row level security;
alter table event_logs enable row level security;
alter table ai_conversations enable row level security;

-- 3) A logged-in user may read only their own profile row.
drop policy if exists "users read own row" on users;
create policy "users read own row" on users
  for select to authenticated
  using (auth_id = auth.uid());