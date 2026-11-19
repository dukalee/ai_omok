import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * 브라우저용 Supabase 클라이언트. 공개 키(anon key)만 쓰며, 데이터 보호는 DB의 RLS 규칙이 맡는다.
 * 환경 변수(.env.local)가 없으면 null이고, 화면은 로그인 기능만 "설정 필요"로 안내한다.
 */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null
