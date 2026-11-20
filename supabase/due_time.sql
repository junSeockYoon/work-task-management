-- 마감 시각(선택). Google Calendar 연동 전에 실행하세요.
-- Supabase SQL Editor 에서 이 파일 전체를 한 번 실행하세요.

alter table public.tasks
  add column if not exists due_time text;

alter table public.tasks drop constraint if exists tasks_due_time_hm;
alter table public.tasks
  add constraint tasks_due_time_hm
  check (due_time is null or due_time ~ '^\d{2}:\d{2}$');
