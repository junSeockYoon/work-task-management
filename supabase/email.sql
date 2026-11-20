-- 회원가입 이메일 저장.
-- Supabase SQL Editor 에서 이 파일 전체를 한 번 실행하세요.
-- 이메일 인증은 아직 쓰지 않습니다. 나중에 알림·인증용으로 씁니다.

alter table public.profiles
  add column if not exists email text;

update public.profiles
set email = lower(username) || '@member.worklog.app'
where email is null;

alter table public.profiles
  alter column email set not null;

alter table public.profiles drop constraint if exists profiles_email_key;
alter table public.profiles
  add constraint profiles_email_key unique (email);

alter table public.profiles drop constraint if exists profiles_email_format;
alter table public.profiles
  add constraint profiles_email_format
  check (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$');
