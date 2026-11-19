import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { accountOf } from './auth'
import type { Account, Role } from './auth'
import { supabase } from './supabase'

/** DB(profiles)에서 내 권한을 읽는다. 읽지 못하면 'user'. 권한의 실제 강제는 DB의 RLS가 하므로 화면 표시용이다. */
async function fetchRole(userId: string): Promise<Role> {
  if (!supabase) return 'user'
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin' ? 'admin' : 'user'
}

/** 지금 로그인한 계정을 구독한다. AccountProvider가 한 번만 부른다. 로그아웃 상태이면 null */
export function useAccountState(): Account | null {
  const [account, setAccount] = useState<Account | null>(null)

  useEffect(() => {
    if (!supabase) return
    let alive = true

    const apply = (session: Session | null) => {
      const base = accountOf(session)
      setAccount(base)
      if (!base) return
      // 권한은 따로 읽어 와서 채운다 (이름 등은 먼저 보여 준다)
      void fetchRole(base.userId).then((role) => {
        if (alive) setAccount((cur) => (cur && cur.userId === base.userId ? { ...cur, role } : cur))
      })
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (alive) apply(data.session)
    })
    // 콜백 안에서 Supabase 호출을 바로 기다리면 교착될 수 있어, 다음 틱으로 미룬다
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => alive && apply(session), 0)
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  return account
}
