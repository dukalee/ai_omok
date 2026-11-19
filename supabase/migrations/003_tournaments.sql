-- 토너먼트. 조회는 누구나, 만들기/진행/삭제는 관리자만 (RLS). 참가 신청은 아래 함수로만 한다.
-- 제출한 코드(entry_codes)는 본인과 관리자만 볼 수 있다.

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 50),
  -- open: 참가 접수 중 / running: 진행 중 / stopped: 중단 / finished: 종료
  status text not null default 'open' check (status in ('open', 'running', 'stopped', 'finished')),
  -- 대진 배치와 코인 던지기에 쓰는 난수 시드 (같은 시드는 같은 대진)
  seed bigint not null default floor(random() * 2147483647)::bigint,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  player_name text not null,
  joined_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);

create table if not exists public.entry_codes (
  entry_id uuid primary key references public.tournament_entries (id) on delete cascade,
  code text not null check (char_length(code) <= 100000)
);

create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round int not null,
  position int not null,
  entry_a uuid references public.tournament_entries (id) on delete set null,
  entry_b uuid references public.tournament_entries (id) on delete set null,
  black_entry uuid references public.tournament_entries (id) on delete set null,
  winner_entry uuid references public.tournament_entries (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'running', 'done')),
  result_reason text,
  -- 착수 기록: [{ "color": "black", "row": 7, "col": 7 }, ...]
  moves jsonb not null default '[]'::jsonb,
  unique (tournament_id, round, position)
);

alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.entry_codes enable row level security;
alter table public.tournament_matches enable row level security;

-- 권한 (프로젝트에서 새 테이블 자동 권한 부여를 꺼 두었으므로 직접 준다. 실제 범위는 아래 RLS 정책이 정한다.)
grant select on public.tournaments, public.tournament_entries, public.tournament_matches to anon, authenticated;
grant insert, update, delete on public.tournaments, public.tournament_matches to authenticated;
grant select on public.entry_codes to authenticated;

-- 조회는 누구나
drop policy if exists "tournaments_select" on public.tournaments;
create policy "tournaments_select" on public.tournaments for select using (true);
drop policy if exists "entries_select" on public.tournament_entries;
create policy "entries_select" on public.tournament_entries for select using (true);
drop policy if exists "matches_select" on public.tournament_matches;
create policy "matches_select" on public.tournament_matches for select using (true);

-- 쓰기는 관리자만
drop policy if exists "tournaments_admin_write" on public.tournaments;
create policy "tournaments_admin_write" on public.tournaments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "matches_admin_write" on public.tournament_matches;
create policy "matches_admin_write" on public.tournament_matches
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 제출 코드는 본인과 관리자만 읽는다
drop policy if exists "entry_codes_select" on public.entry_codes;
create policy "entry_codes_select" on public.entry_codes
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.tournament_entries e where e.id = entry_id and e.user_id = auth.uid())
  );

-- 참가 신청: 접수 중(open)인 토너먼트에만, 한 사람이 한 번 (다시 신청하면 코드를 바꾼다)
create or replace function public.join_tournament(p_tournament uuid, p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_entry uuid;
begin
  if auth.uid() is null then
    raise exception 'login required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tournaments where id = p_tournament and status = 'open') then
    raise exception 'tournament is not open' using errcode = '22023';
  end if;
  if p_code is null or char_length(btrim(p_code)) = 0 then
    raise exception 'code is empty' using errcode = '22023';
  end if;
  select name into v_name from public.profiles where id = auth.uid();

  insert into public.tournament_entries (tournament_id, user_id, player_name)
  values (p_tournament, auth.uid(), coalesce(v_name, 'Player'))
  on conflict (tournament_id, user_id) do update set player_name = excluded.player_name
  returning id into v_entry;

  insert into public.entry_codes (entry_id, code) values (v_entry, p_code)
  on conflict (entry_id) do update set code = excluded.code;
  return v_entry;
end;
$$;

-- 참가 취소: 접수 중일 때만
create or replace function public.leave_tournament(p_tournament uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'login required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tournaments where id = p_tournament and status = 'open') then
    raise exception 'tournament is not open' using errcode = '22023';
  end if;
  delete from public.tournament_entries where tournament_id = p_tournament and user_id = auth.uid();
end;
$$;

revoke all on function public.join_tournament(uuid, text), public.leave_tournament(uuid) from public, anon;
grant execute on function public.join_tournament(uuid, text), public.leave_tournament(uuid) to authenticated;
