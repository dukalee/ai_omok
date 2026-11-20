import { signOut } from '../auth/auth'
import { useAccount } from '../auth/AccountContext'
import AuthForm from './AuthForm'
import BrandArt from './BrandArt'

export interface TitlePageProps {
  onStartTutorial: () => void
  onStartPractice: () => void
  onStartTournament: () => void
  onStartAdmin: () => void
}

/** 시작 화면: 왼쪽은 브랜드 영역, 오른쪽은 로그인 전에는 로그인 폼, 로그인 후에는 모드 메뉴. */
export default function TitlePage({ onStartTutorial, onStartPractice, onStartTournament, onStartAdmin }: TitlePageProps) {
  const account = useAccount()

  return (
    <div className="title-split">
      <section className="title-brand">
        <BrandArt />
        <div className="title-brand-ghost" aria-hidden="true">
          CODE
        </div>
        <h1 className="title-brand-name" aria-label="CODE OMOK">
          OMOK
        </h1>
        <p className="title-brand-tagline">내 코드로 두는 오목</p>
      </section>

      <section className="title-side">
        {account ? (
          <div className="title-menu">
            <h2 className="title-menu-name">안녕하세요, {account.name}님</h2>
            <button type="button" className="btn btn-outline btn-block menu-btn" onClick={onStartTutorial}>
              <span>튜토리얼</span>
              <small>규칙 익히기</small>
            </button>
            <button type="button" className="btn btn-outline btn-block menu-btn" onClick={onStartPractice}>
              <span>연습</span>
              <small>AI와 대결</small>
            </button>
            <button type="button" className="btn btn-outline btn-block menu-btn" onClick={onStartTournament}>
              <span>토너먼트</span>
              <small>참가하기</small>
            </button>
            {account.role === 'admin' && (
              <button type="button" className="btn btn-outline btn-block menu-btn menu-btn-admin" onClick={onStartAdmin}>
                <span>관리자</span>
                <small>회원과 토너먼트 관리</small>
              </button>
            )}
            <button type="button" className="auth-link title-logout" onClick={() => void signOut()}>
              로그아웃
            </button>
          </div>
        ) : (
          <AuthForm />
        )}
      </section>
    </div>
  )
}
