import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { Account } from './auth'
import { useAccountState } from './useAccount'

const AccountContext = createContext<Account | null>(null)

/** 로그인 상태 구독을 앱 전체에서 한 번만 하고, 모든 화면이 같은 계정 정보를 쓰게 한다. */
export function AccountProvider({ children }: { children: ReactNode }) {
  const account = useAccountState()
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>
}

/** 지금 로그인한 계정. 로그아웃 상태이면 null */
export function useAccount(): Account | null {
  return useContext(AccountContext)
}
