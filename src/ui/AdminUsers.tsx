import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../auth/supabase'
import ConfirmModal from './ConfirmModal'

interface UserRow {
  id: string
  login_id: string
  name: string
  role: 'user' | 'admin'
  created_at: string
}

const formatDate = (iso: string) => new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })

/** 관리자용 회원 목록. 회원을 볼 수 있고 삭제할 수 있다 (권한은 DB의 RLS와 함수가 강제한다). */
export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [target, setTarget] = useState<UserRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data, error: e } = await supabase
      .from('profiles')
      .select('id, login_id, name, role, created_at')
      .order('created_at', { ascending: true })
    if (e) setError('회원 목록을 불러오지 못했습니다.')
    else {
      setError(null)
      setUsers(data as UserRow[])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove() {
    if (!supabase || !target) return
    setDeleting(true)
    setDeleteError(null)
    const { error: e } = await supabase.rpc('admin_delete_user', { target: target.id })
    setDeleting(false)
    if (e) {
      setDeleteError('삭제하지 못했습니다.')
      return
    }
    setTarget(null)
    await load()
  }

  return (
    <section className="card admin-card" aria-label="회원 관리">
      <h4 className="card-title">
        <span>회원 {users ? `${users.length}명` : ''}</span>
      </h4>
      {error && <p className="admin-error">{error}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>이름</th>
              <th>가입일</th>
              <th aria-label="삭제" />
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.login_id}
                  {u.role === 'admin' && <span className="admin-badge">관리자</span>}
                </td>
                <td>{u.name}</td>
                <td>{formatDate(u.created_at)}</td>
                <td className="admin-actions">
                  {u.role !== 'admin' && (
                    <button type="button" className="btn-reset btn-reset-danger" onClick={() => setTarget(u)}>
                      삭제
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users?.length === 0 && (
              <tr>
                <td colSpan={4} className="admin-empty">
                  회원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {target && (
        <ConfirmModal
          title="회원 삭제"
          message={`${target.name}(${target.login_id}) 회원을 삭제합니다. 이 회원의 정보와 제출한 코드가 모두 지워지며 되돌릴 수 없습니다.`}
          confirmLabel="삭제"
          danger
          busy={deleting}
          error={deleteError}
          onConfirm={() => void remove()}
          onClose={() => !deleting && setTarget(null)}
        />
      )}
    </section>
  )
}
