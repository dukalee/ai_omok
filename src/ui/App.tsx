import { useState } from 'react'
import PracticePage from './PracticePage'
import TitlePage from './TitlePage'
import './ui.css'

type Screen = 'title' | 'practice'

export default function App() {
  const [screen, setScreen] = useState<Screen>('title')

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="logo" onClick={() => setScreen('title')} aria-label="처음 화면으로">
          <span className="logo-mark" aria-hidden="true" />
          AI 오목
        </button>
        <nav className="modes" aria-label="모드">
          <button
            type="button"
            className={screen === 'practice' ? 'mode on' : 'mode'}
            aria-current={screen === 'practice' ? 'page' : undefined}
            onClick={() => setScreen('practice')}
          >
            연습
          </button>
          <button type="button" className="mode" disabled>
            토너먼트 · 준비 중
          </button>
        </nav>
      </header>

      <main className="main">
        {screen === 'practice' ? (
          <PracticePage />
        ) : (
          <TitlePage onStartPractice={() => setScreen('practice')} />
        )}
      </main>

      <footer className="footer">
        <small>© 2026 aishift. All rights reserved.</small>
      </footer>
    </div>
  )
}
