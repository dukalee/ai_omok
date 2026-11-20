import { useState } from 'react'
import type { FormEvent } from 'react'
import { signIn, signUp } from '../auth/auth'
import { validateId, validateName, validatePassword } from '../auth/credentials'

type AuthMode = 'login' | 'signup'

/**
 * 시작 화면에 바로 보이는 로그인 / 회원가입 폼. 회원가입에는 ID, 이름, PASSWORD만 받는다.
 * 성공하면 로그인 상태가 바뀌어 시작 화면이 메뉴로 바뀐다(이 폼은 사라진다).
 */
export default function AuthForm() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const signup = mode === 'signup'

  function switchMode() {
    setMode(signup ? 'login' : 'signup')
    setError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const problem = signup
      ? (validateId(id) ?? validateName(name) ?? validatePassword(password))
      : !id.trim()
        ? 'ID를 입력하세요.'
        : !password
          ? 'PASSWORD를 입력하세요.'
          : null
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    const result = signup ? await signUp(id, name, password) : await signIn(id, password)
    setBusy(false)
    if (!result.ok) setError(result.message)
  }

  return (
    <form className="auth-inline" onSubmit={(e) => void submit(e)} noValidate>
      <h2 className="auth-inline-title">{signup ? '회원가입' : '로그인'}</h2>

      <label className="auth-field">
        ID
        <input
          type="text"
          value={id}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={signup ? '영문 소문자, 숫자, _ (4~20자)' : undefined}
          disabled={busy}
          onChange={(e) => setId(e.target.value)}
        />
      </label>

      {signup && (
        <label className="auth-field">
          이름
          <input
            type="text"
            value={name}
            autoComplete="name"
            maxLength={20}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      )}

      <label className="auth-field">
        PASSWORD
        <input
          type="password"
          value={password}
          autoComplete={signup ? 'new-password' : 'current-password'}
          placeholder={signup ? '6자 이상' : undefined}
          disabled={busy}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <p className="auth-error" role="alert">
        {error}
      </p>

      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? '처리 중…' : signup ? '가입하기' : '로그인'}
      </button>
      <button type="button" className="btn btn-outline btn-block" disabled={busy} onClick={switchMode}>
        {signup ? '로그인으로 돌아가기' : '회원가입'}
      </button>
    </form>
  )
}
