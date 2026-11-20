import { useEffect, useState } from 'react'
import { AccountProvider, useAccount } from '../auth/AccountContext'
import { clearLegacyLocalData } from '../storage/cloud'
import AdminPage from './AdminPage'
import PracticePage from './PracticePage'
import TournamentPage from './TournamentPage'
import TitlePage from './TitlePage'
import TutorialPage from './TutorialPage'
import './ui.css'

type Screen = 'title' | 'tutorial' | 'practice' | 'tournament' | 'admin'

// 코드와 진행 기록은 계정에 저장한다. 이 컴퓨터에 남아 있던 예전 데이터는 다른 계정에 섞이지 않게 지운다.
clearLegacyLocalData()

export default function App() {
  return (
    <AccountProvider>
      <Shell />
    </AccountProvider>
  )
}

function Shell() {
  const [screen, setScreen] = useState<Screen>('title')
  const account = useAccount()

  // 브라우저의 뒤로가기, 앞으로가기가 화면 이동을 따라가도록 화면마다 기록(history)을 남긴다.
  // 새로고침하면 처음 화면에서 시작한다.
  useEffect(() => {
    history.replaceState({ screen: 'title' }, '')
    const onPop = (e: PopStateEvent) => setScreen((e.state as { screen?: Screen } | null)?.screen ?? 'title')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = (next: Screen) => {
    if (next === screen) return
    history.pushState({ screen: next }, '')
    setScreen(next)
  }
  const isAdmin = account?.role === 'admin'

  // 로그인해야 쓸 수 있다. 로그아웃하거나 관리자 권한을 잃으면 처음 화면으로 돌아간다
  useEffect(() => {
    if (screen !== 'title' && !account) setScreen('title')
    else if (screen === 'admin' && !isAdmin) setScreen('title')
  }, [screen, account, isAdmin])

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="logo" onClick={() => go('title')} aria-label="처음 화면으로">
          <span className="logo-mark" aria-hidden="true" />
          <span className="logo-text">
            <span className="logo-code">CODE</span> OMOK
          </span>
        </button>
        {screen !== 'title' && (
          <button type="button" className="topbar-back" onClick={() => go('title')}>
            ← 처음으로
          </button>
        )}
      </header>

      <main className="main">
        {account && screen === 'admin' && isAdmin ? (
          <AdminPage />
        ) : account && screen === 'practice' ? (
          <PracticePage />
        ) : account && screen === 'tournament' ? (
          <TournamentPage />
        ) : account && screen === 'tutorial' ? (
          <TutorialPage />
        ) : (
          <TitlePage
            onStartTutorial={() => go('tutorial')}
            onStartPractice={() => go('practice')}
            onStartTournament={() => go('tournament')}
            onStartAdmin={() => go('admin')}
          />
        )}
      </main>

      <footer className="footer">
        <small>© 2026 aishift. All rights reserved.</small>
      </footer>
    </div>
  )
}
