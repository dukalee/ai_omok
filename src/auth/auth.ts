import type { Session } from '@supabase/supabase-js'
import { idToEmail, normalizeId } from './credentials'
import { supabase } from './supabase'

export type Role = 'user' | 'admin'

export interface Account {
  /** 로그인 ID */
  id: string
  name: string
  /** Supabase auth 사용자 id (DB 행의 주인) */
  userId: string
  /** DB(profiles.role)에서 읽은 권한. 읽기 전에는 'user' */
  role: Role
}

export type AuthResult = { ok: true } | { ok: false; message: string }

const NOT_CONFIGURED = '로그인 서버가 설정되지 않았습니다. (.env.local에 Supabase 주소와 키가 필요합니다)'

/** Supabase 오류를 학습자가 읽을 문구로 바꾼다 */
function explain(error: { message: string; code?: string }, mode: 'login' | 'signup'): string {
  const text = error.message.toLowerCase()
  if (mode === 'login' && text.includes('invalid login')) return 'ID 또는 비밀번호가 맞지 않습니다.'
  if (mode === 'signup' && (text.includes('already registered') || text.includes('already been registered')))
    return '이미 사용 중인 ID입니다.'
  if (text.includes('email not confirmed')) return '이메일 확인이 켜져 있습니다. 관리자에게 문의하세요.'
  if (text.includes('rate limit')) return '잠시 후 다시 시도하세요.'
  if (text.includes('failed to fetch') || text.includes('network')) return '서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요.'
  return `오류가 발생했습니다: ${error.message}`
}

export async function signUp(id: string, name: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: NOT_CONFIGURED }
  const { data, error } = await supabase.auth.signUp({
    email: idToEmail(id),
    password,
    // DB의 트리거가 이 값으로 profiles 행을 만든다 (supabase/migrations/001_profiles.sql)
    options: { data: { login_id: normalizeId(id), name: name.trim() } },
  })
  if (error) return { ok: false, message: explain(error, 'signup') }
  // 이메일 확인이 켜져 있으면 세션이 없다 — 이 앱은 확인 메일을 쓰지 않는다
  if (!data.session) return { ok: false, message: '가입은 되었지만 로그인되지 않았습니다. 이메일 확인 설정을 꺼 주세요.' }
  return { ok: true }
}

export async function signIn(id: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: NOT_CONFIGURED }
  const { error } = await supabase.auth.signInWithPassword({ email: idToEmail(id), password })
  return error ? { ok: false, message: explain(error, 'login') } : { ok: true }
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
}

export function accountOf(session: Session | null): Account | null {
  const user = session?.user
  if (!user) return null
  const meta = user.user_metadata as { login_id?: string; name?: string }
  return { id: meta.login_id ?? '', name: meta.name ?? meta.login_id ?? '', userId: user.id, role: 'user' }
}
