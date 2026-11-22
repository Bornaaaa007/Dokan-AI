-- ============================================================
-- Complaints migration. Safe to re-run.
-- 1) two additive columns so the accused party's evidence is kept apart from the filer's
-- 2) decide_complaint(): decides a complaint and (optionally) issues the badge in ONE transaction
-- ============================================================

alter table complaints
  add column if not exists response_evidence_urls text[] not null default '{}',
  add column if not exists responded_at timestamptz;

create or replace function decide_complaint(
  p_complaint_id uuid,
  p_admin_id     uuid,
  p_outcome      text,
  p_note         text,
  p_issue_badge  boolean default false
) returns jsonb
language plpgsql
as $$
declare
  c         complaints%rowtype;
  v_badge   badges%rowtype;
  v_created boolean := false;
begin
  if p_outcome is null or p_outcome not in ('upheld', 'rejected') then
    raise exception 'invalid_outcome';
  end if;
  if p_note is null or length(trim(p_note)) < 10 then
    raise exception 'note_required';
  end if;
  if not exists (select 1 from users where id = p_admin_id and 'admin' = any(roles)) then
    raise exception 'admin_required';
  end if;

  -- lock the row so two admins cannot decide the same complaint at once
  select * into c from complaints where id = p_complaint_id for update;
  if not found then
    raise exception 'complaint_not_found';
  end if;
  if c.status not in ('submitted', 'responded') then
    raise exception 'already_decided';
  end if;
  if p_admin_id in (c.filed_by, c.accused_id) then
    raise exception 'conflict_of_interest';
  end if;

  update complaints
     set status        = p_outcome::complaint_status_t,
         decision_note = trim(p_note),
         decided_by    = p_admin_id,
         decided_at    = now()
   where id = c.id
  returning * into c;

  -- Badge: only for an upheld complaint, only when the caller asked for it, never a duplicate.
  if p_outcome = 'upheld' and p_issue_badge then
    select * into v_badge
      from badges
     where user_id = c.accused_id and role = c.accused_role
       and status = 'active' and expires_at > now()
     limit 1;
    if not found then
      insert into badges (user_id, role, source_complaint_id, status, issued_at, expires_at)
      values (c.accused_id, c.accused_role, c.id, 'active', now(),
              now() + case when c.accused_role = 'seller' then interval '6 months' else interval '3 months' end)
      returning * into v_badge;
      v_created := true;
    end if;
  end if;

  return jsonb_build_object(
    'complaint',     to_jsonb(c),
    'badge',         case when v_badge.id is null then null else to_jsonb(v_badge) end,
    'badge_created', v_created
  );
end;
$$;

-- Only your server (the secret key) may call it. The public keys must not.
revoke execute on function decide_complaint(uuid, uuid, text, text, boolean) from public, anon, authenticated;
