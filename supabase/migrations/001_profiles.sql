-- 회원 정보. 로그인(비밀번호)은 Supabase Auth(auth.users)가 맡고, 여기에는 ID와 이름만 둔다.
-- 앱은 ID를 가짜 이메일 "<id>@omok.app"으로 바꿔 가입시킨다 (src/auth/credentials.ts).
-- 사전 설정: Authentication > Sign In / Providers > Email 에서 "Confirm email"을 끈다.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  login_id text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  constraint profiles_login_id_format check (login_id ~ '^[a-z0-9_]{4,20}$'),
  constraint profiles_name_length check (char_length(btrim(name)) between 1 and 20)
);

alter table public.profiles enable row level security;

-- Data API로 읽을 수 있게 권한을 준다 (프로젝트 생성 시 "새 테이블 자동 권한 부여"를 켜지 않았다).
-- 실제 접근 범위는 아래 RLS 정책이 정한다.
grant select on public.profiles to authenticated;

-- 로그인한 사용자는 자기 정보만 읽을 수 있다. 쓰기는 아래 트리거(가입 시)만 한다.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

-- 가입하면 profiles 행을 자동으로 만든다. 값은 signUp 때 넘긴 user_metadata(login_id, name)에서 가져온다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, login_id, name)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'login_id'),
    btrim(new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
