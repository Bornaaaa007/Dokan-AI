-- Run ONCE in the Supabase SQL Editor (tell Person 2 first). Additive only: nothing existing changes.
-- Lets the admin's rejection reason be shown to the seller inside the app (it is also emailed).
alter table public.shops add column if not exists rejection_note text;
