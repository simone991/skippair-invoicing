'use client'
import { useState } from 'react'
import { Profile, UserRole } from '@/types'
import { Plus, X, UserX, UserCheck } from 'lucide-react'

export default function UsersClient({ users: initial, currentUserId }: { users: Profile[]; currentUserId: string }) {
  const [users, setUsers] = useState(initial)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirmPw: '', role: 'user' as UserRole })

  const filtered = users.filter(u => !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || (u.email ?? '').toLowerCase().includes(search.toLowerCase()))
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirmPw) { setFormError('Passwords do not match.'); return }
    if (form.password.length < 8) { setFormError('Password must be at least 8 characters.'); return }
    setSaving(true); setFormError('')
    const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: form.full_name, email: form.email, password: form.password, role: form.role }) })
    const data = await res.json(); setSaving(false)
    if (!res.ok) { setFormError(data.error ?? 'Failed to create user'); return }
    setFormSuccess(`User ${form.email} created.`)
    setUsers(prev => [...prev, { id: data.user.id, full_name: form.full_name, role: form.role, status: 'active', email: form.email, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
    setForm({ full_name: '', email: '', password: '', confirmPw: '', role: 'user' })
    setTimeout(() => { setShowAdd(false); setFormSuccess('') }, 1500)
  }

  const toggleStatus = async (u: Profile) => {
    if (u.id === currentUserId) return
    const newStatus = u.status === 'active' ? 'disabled' : 'active'
    const res = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, status: newStatus }) })
    if (res.ok) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status: newStatus } : x))
  }

  const changeRole = async (u: Profile, role: UserRole) => {
    if (u.id === currentUserId) return
    const res = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, role }) })
    if (res.ok) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role } : x))
  }

  const ROLE_BADGE: Record<UserRole, string> = { admin: 'badge-red', manager: 'badge-amber', user: 'badge-navy' }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div><div style={{ fontSize: 20, fontWeight: 600 }}>Users</div><div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 3 }}>Manage team access and roles</div></div>
        <button className="btn btn-teal btn-sm" onClick={() => setShowAdd(true)}><Plus size={13} /> New user</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <input className="form-input" type="text" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320, marginBottom: 16 }} />
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>
                  {u.full_name}
                  {u.id === currentUserId && <span style={{ fontSize: 10, color: 'var(--gray-400)', marginLeft: 6 }}>you</span>}
                </td>
                <td style={{ color: 'var(--gray-600)' }}>{u.email}</td>
                <td>
                  {u.id === currentUserId
                    ? <span className={`badge ${ROLE_BADGE[u.role]}`}>{u.role}</span>
                    : <select className="form-select" style={{ width: 110, padding: '4px 8px', fontSize: 12 }} value={u.role} onChange={e => changeRole(u, e.target.value as UserRole)}>
                        <option value="user">user</option>
                        <option value="manager">manager</option>
                        <option value="admin">admin</option>
                      </select>
                  }
                </td>
                <td><span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`}>{u.status}</span></td>
                <td>
                  {u.id !== currentUserId && (
                    <button className={`btn btn-sm ${u.status === 'active' ? 'btn-outline' : 'btn-teal'}`} onClick={() => toggleStatus(u)}>
                      {u.status === 'active' ? <><UserX size={12} /> Disable</> : <><UserCheck size={12} /> Enable</>}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role legend */}
      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Role permissions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, fontSize: 12 }}>
          {[
            { role: 'user', badge: 'badge-navy', perms: ['View invoices list', 'View recipients'] },
            { role: 'manager', badge: 'badge-amber', perms: ['All user permissions +', 'Create / issue / send invoices', 'Add & edit recipients', 'Import CSV'] },
            { role: 'admin', badge: 'badge-red', perms: ['All manager permissions +', 'Cancel invoices', 'Disable recipients', 'Manage users', 'Edit settings'] },
          ].map(item => (
            <div key={item.role} style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: 14 }}>
              <div style={{ marginBottom: 8 }}><span className={`badge ${item.badge}`}>{item.role}</span></div>
              <ul style={{ paddingLeft: 16, color: 'var(--gray-600)', lineHeight: 2 }}>
                {item.perms.map(p => <li key={p}>{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>New user</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ padding: 24 }}>
                {formSuccess && <div className="alert alert-success" style={{ marginBottom: 14 }}>{formSuccess}</div>}
                {formError && <div className="alert alert-error" style={{ marginBottom: 14 }}>{formError}</div>}
                <div style={{ display: 'grid', gap: 14 }}>
                  {[
                    { label: 'Full name', key: 'full_name', type: 'text', placeholder: 'Marie Dupont' },
                    { label: 'Email', key: 'email', type: 'email', placeholder: 'marie@skippair.com' },
                    { label: 'Password', key: 'password', type: 'password', placeholder: 'Min. 8 characters' },
                    { label: 'Confirm password', key: 'confirmPw', type: 'password', placeholder: 'Repeat password' },
                  ].map(f => (
                    <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>{f.label} <span style={{ color: 'var(--red)' }}>*</span></label>
                      <input className="form-input" type={f.type} placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]} onChange={e => setF(f.key, e.target.value)} required />
                    </div>
                  ))}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Role <span style={{ color: 'var(--red)' }}>*</span></label>
                    <select className="form-select" value={form.role} onChange={e => setF('role', e.target.value)}>
                      <option value="user">user — Read-only</option>
                      <option value="manager">manager — Can issue invoices</option>
                      <option value="admin">admin — Full access</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAdd(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-teal" disabled={saving}>
                  {saving ? <><div className="spinner" style={{ borderColor: 'rgba(255,255,255,.4)', borderTopColor: 'white' }} />Creating…</> : <><Plus size={13} />Create user</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
