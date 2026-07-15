alter table public.session_packages
  add column if not exists closed_at timestamptz,
  add column if not exists closure_reason text;
