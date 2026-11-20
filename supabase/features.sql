-- 체크리스트, 반복, 삭제 취소.
-- Supabase SQL Editor 에서 이 파일 전체를 한 번 실행하세요.
-- 검색은 서버에 저장된 목록을 화면에서 거르므로 테이블을 바꾸지 않습니다.

alter table public.tasks
  add column if not exists checks jsonb not null default '[]'::jsonb;

alter table public.tasks
  add column if not exists repeat text not null default 'none';

alter table public.tasks
  add column if not exists deleted_at timestamptz;

alter table public.tasks drop constraint if exists tasks_checks_array;
alter table public.tasks
  add constraint tasks_checks_array check (jsonb_typeof(checks) = 'array');

alter table public.tasks drop constraint if exists tasks_repeat_value;
alter table public.tasks
  add constraint tasks_repeat_value check (repeat in ('none', 'daily', 'weekly', 'monthly'));

create index if not exists tasks_user_active_due_idx
  on public.tasks (user_id, due_date)
  where deleted_at is null;
