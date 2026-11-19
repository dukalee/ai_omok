-- 관리자 권한. 관리자 여부는 ID가 아니라 profiles.role 로 정하고, 클라이언트(anon/authenticated)는 이 값을 바꿀 수 없다
-- (profiles에는 select 권한만 있다). 관리자 지정은 대시보드 SQL로만 한다:
--   update public.profiles set role = 'admin' where login_id = 'admin';

alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin'));

-- 지금 로그인한 사용자가 관리자인지. security definer라서 RLS 정책 안에서 불러도 재귀하지 않는다.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 관리자는 모든 회원을 볼 수 있다 (일반 회원은 기존 정책대로 자기 정보만).
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select to authenticated
  using (public.is_admin());

-- 관리자만 회원을 삭제할 수 있다. auth.users를 지우면 profiles 등 딸린 데이터도 함께 지워진다.
-- 관리자 자신과 다른 관리자는 지울 수 없다.
create or replace function public.admin_delete_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = target and role = 'admin') then
    raise exception 'admin accounts cannot be deleted' using errcode = '42501';
  end if;
  delete from auth.users where id = target;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
