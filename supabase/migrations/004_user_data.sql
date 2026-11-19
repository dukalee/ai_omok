-- 계정별 저장. 연습/튜토리얼에서 작성한 코드와 튜토리얼 통과 기록을 브라우저가 아니라 계정에 저장한다.
-- 새로 가입한 계정에는 아무 행도 없으므로 진행 기록이 비어 있다. 본인 행만 읽고 쓸 수 있다(RLS).
-- 계정(auth.users)이 삭제되면 함께 지워진다.

create table if not exists public.user_codes (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 'practice' (연습 코드), 'tutorial:<레벨 id>' (튜토리얼 레벨별 코드)
  slot text not null check (char_length(slot) between 1 and 40),
  code text not null check (char_length(code) <= 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

create table if not exists public.tutorial_cleared (
  user_id uuid not null references auth.users (id) on delete cascade,
  level_id int not null check (level_id > 0),
  cleared_at timestamptz not null default now(),
  primary key (user_id, level_id)
);

alter table public.user_codes enable row level security;
alter table public.tutorial_cleared enable row level security;

grant select, insert, update, delete on public.user_codes to authenticated;
grant select, insert, update, delete on public.tutorial_cleared to authenticated;

drop policy if exists "user_codes_own" on public.user_codes;
create policy "user_codes_own" on public.user_codes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "tutorial_cleared_own" on public.tutorial_cleared;
create policy "tutorial_cleared_own" on public.tutorial_cleared
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
