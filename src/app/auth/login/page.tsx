'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) { setError('Invalid email or password.'); setLoading(false); return }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Login failed. Please try again.'); setLoading(false); return }

      const { data: profile } = await supabase.from('profiles').select('status').eq('id', user.id).single()
      if (profile?.status === 'disabled') {
        await supabase.auth.signOut()
        setError('Your account has been disabled. Contact an administrator.')
        setLoading(false); return
      }
      router.push(redirect); router.refresh()
    } catch (err) {
      console.error('Login error:', err)
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 40, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <div style={{ width: 40, height: 40, background: 'var(--teal)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ width: 20, height: 20 }}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--gray-800)' }}>Skippair Invoicing</div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>CMSea SAS · Nantes</div>
        </div>
      </div>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Email address</label>
          <input className="form-input" type="email" placeholder="you@skippair.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Password</label>
            <Link href="/auth/reset-password" style={{ fontSize: 12, color: 'var(--teal)', textDecoration: 'none' }}>Forgot password?</Link>
          </div>
          <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        {error && <div className="alert alert-error" style={{ fontSize: 13 }}>{error}</div>}
        <button type="submit" className="btn btn-teal btn-lg" disabled={loading} style={{ justifyContent: 'center', width: '100%', marginTop: 4 }}>
          {loading ? <><div className="spinner" style={{ borderColor: 'rgba(255,255,255,.4)', borderTopColor: 'white' }} /> Signing in…</> : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ background: 'white', borderRadius: 16, padding: 40, width: '100%', maxWidth: 400 }} />}>
      <LoginForm />
    </Suspense>
  )
}
