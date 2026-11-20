/**
 * 회원가입 입력값 검사. Supabase Auth는 이메일로 계정을 구분하므로,
 * 사용자가 정한 ID를 가짜 이메일(`<id>@omok.app`)로 바꿔 쓴다. 이 주소로 메일을 보내지는 않는다.
 * (Supabase 대시보드에서 "Confirm email"을 꺼 두어야 한다)
 */

export const EMAIL_DOMAIN = 'omok.app'

export const ID_PATTERN = /^[a-z0-9_]{4,20}$/
export const PASSWORD_MIN = 6
export const NAME_MAX = 20

/** ID는 대소문자를 구분하지 않도록 소문자로 맞춘다 */
export const normalizeId = (id: string): string => id.trim().toLowerCase()

export const idToEmail = (id: string): string => `${normalizeId(id)}@${EMAIL_DOMAIN}`

/** 문제가 있으면 안내 문구, 없으면 null */
export function validateId(id: string): string | null {
  return ID_PATTERN.test(normalizeId(id)) ? null : 'ID는 영문 소문자, 숫자, _ 로 4~20자여야 합니다.'
}

export function validateName(name: string): string | null {
  const n = name.trim()
  if (n.length === 0) return '이름을 입력하세요.'
  if (n.length > NAME_MAX) return `이름은 ${NAME_MAX}자까지 입력할 수 있습니다.`
  return null
}

export function validatePassword(password: string): string | null {
  return password.length >= PASSWORD_MIN ? null : `PASSWORD는 ${PASSWORD_MIN}자 이상이어야 합니다.`
}
