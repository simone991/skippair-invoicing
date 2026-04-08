'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<'request' | 'verify' | 'done'>('request')
  const [email, setEmail] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password?step=verify`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setStep('verify')
  }

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return }
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password: newPw })
    setLoading(false)
    if (err) { setError(err.message); return }
    setStep('done')
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  const boxStyle = { background: 'white', borderRadius: 16, padding: 40, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }

  return (
    <div style={boxStyle}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
        {step === 'request' && 'Reset password'}
        {step === 'verify' && 'Set new password'}
        {step === 'done' && '✓ Password updated'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 24 }}>Skippair Invoicing</div>

      {step === 'request' && (
        <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--gray-600)' }}>Enter your email to receive a reset link.</p>
          <input className="form-input" type="email" placeholder="you@skippair.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-teal btn-lg" disabled={loading} style={{ justifyContent: 'center' }}>
            {loading ? <><div className="spinner" style={{ borderColor: 'rgba(255,255,255,.4)', borderTopColor: 'white' }} />Sending…</> : 'Send reset link'}
          </button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="alert alert-success" style={{ marginBottom: 4 }}>Check your email and click the reset link, then return here.</div>
          <input className="form-input" type="password" placeholder="New password (min. 8 chars)" value={newPw} onChange={e => setNewPw(e.target.value)} required />
          <input className="form-input" type="password" placeholder="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-teal btn-lg" disabled={loading} style={{ justifyContent: 'center' }}>
            {loading ? <><div className="spinner" style={{ borderColor: 'rgba(255,255,255,.4)', borderTopColor: 'white' }} />Saving…</> : 'Set new password'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div style={{ textAlign: 'center', color: 'var(--gray-600)', fontSize: 14 }}>
          Password updated. Redirecting to dashboard…
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <Link href="/auth/login" style={{ fontSize: 12, color: 'var(--teal)', textDecoration: 'none' }}>← Back to login</Link>
      </div>
    </div>
  )
}
