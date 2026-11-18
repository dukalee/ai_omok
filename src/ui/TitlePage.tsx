export interface TitlePageProps {
  onStartPractice: () => void
}

export default function TitlePage({ onStartPractice }: TitlePageProps) {
  return (
    <div className="title-stage">
      <section className="card title-card">
        <span className="logo-mark logo-mark-large" aria-hidden="true" />
        <h1 className="title-name">AI 오목</h1>
        <p className="title-tagline">내 코드로 두는 오목</p>
        <button type="button" className="btn btn-primary btn-block" onClick={onStartPractice}>
          연습 시작
        </button>
        <button type="button" className="btn btn-dashed btn-block" disabled>
          토너먼트 · 준비 중
        </button>
      </section>
    </div>
  )
}
