-- 회원가입/로그인용 프로필과 업무 소유자.
-- Supabase SQL Editor 에서 이 파일 전체를 한 번 실행하세요.
-- 아이디는 서버에서 소문자로 저장합니다.
-- 비밀번호는 Supabase Auth 에만 저장됩니다.
-- 이미 profiles 가 있다면 supabase/email.sql 을 이어서 실행하세요.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  phone text not null,
  email text not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_key unique (username),
  constraint profiles_email_key unique (email),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{4,20}$'),
  constraint profiles_phone_format check (phone ~ '^01[0-9]{8,9}$'),
  constraint profiles_email_format check (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$')
);

alter table public.tasks
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists tasks_user_id_due_date_idx
  on public.tasks (user_id, due_date);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists tasks_select_own on public.tasks;
create policy tasks_select_own
  on public.tasks
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own
  on public.tasks
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own
  on public.tasks
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own
  on public.tasks
  for delete
  to authenticated
  using (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
