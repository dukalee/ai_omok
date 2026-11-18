import { STARTER_CODE } from '../python/starter'

export const CODE_KEY = 'omok.code.v1'

/** 저장해 둔 코드. 없거나 localStorage에 접근할 수 없으면 예제 코드. */
export function loadCode(storage?: Pick<Storage, 'getItem'>): string {
  try {
    const store = storage ?? localStorage
    const saved = store.getItem(CODE_KEY)
    return saved ?? STARTER_CODE
  } catch {
    return STARTER_CODE
  }
}

/** 코드를 저장한다. localStorage를 쓸 수 없어도 화면은 정상 동작해야 하므로 실패는 무시한다. */
export function saveCode(code: string, storage?: Pick<Storage, 'setItem'>): void {
  try {
    const store = storage ?? localStorage
    store.setItem(CODE_KEY, code)
  } catch {
    // 개인정보 보호 모드 등에서는 저장을 건너뛴다
  }
}
