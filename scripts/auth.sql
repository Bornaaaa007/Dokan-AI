drop policy if exists "users update own row" on users;
create policy "users update own row" on users
  for update to authenticated
  using (auth_id = auth.uid())
  with check (auth_id = auth.uid());

-- Column-level lock: the browser may change only name and phone, never roles.
revoke update on users from anon, authenticated;
grant update (name, phone) on users to authenticated;