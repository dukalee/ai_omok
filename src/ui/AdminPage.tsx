import { useState } from 'react'
import AdminTournaments from './AdminTournaments'
import AdminUsers from './AdminUsers'

type Tab = 'users' | 'tournaments'

/** 관리자 화면: 회원 관리와 토너먼트 관리. */
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('tournaments')
  return (
    <div className="admin-page">
      <div className="admin-tabs" role="tablist" aria-label="관리 메뉴">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tournaments'}
          className={tab === 'tournaments' ? 'admin-tab on' : 'admin-tab'}
          onClick={() => setTab('tournaments')}
        >
          토너먼트
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'users'}
          className={tab === 'users' ? 'admin-tab on' : 'admin-tab'}
          onClick={() => setTab('users')}
        >
          회원
        </button>
      </div>
      {tab === 'tournaments' ? <AdminTournaments /> : <AdminUsers />}
    </div>
  )
}
