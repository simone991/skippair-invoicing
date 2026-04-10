'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Profile } from '@/types'

interface SidebarProps { profile: Profile }

const NAV = [
  { href: '/dashboard',    label: 'Dashboard',   roles: ['user','manager','admin'], icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
  { href: '/invoices',     label: 'Invoices',    roles: ['user','manager','admin'], icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' },
  { href: '/invoices/new', label: 'New Invoice', roles: ['manager','admin'],        icon: 'M12 5v14M5 12h14' },
  { href: '/recipients',   label: 'Recipients',  roles: ['user','manager','admin'], icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2' },
]
const ADMIN_NAV = [
  { href: '/users',    label: 'Users',    icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2' },
  { href: '/settings', label: 'Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6z' },
]

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const logout = async () => { await supabase.auth.signOut(); router.push('/auth/login'); router.refresh() }
  const active = (href: string) => href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
  const initials = profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const itemStyle = (href: string) => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
    color: active(href) ? 'white' : 'rgba(255,255,255,.6)',
    background: active(href) ? 'rgba(0,204,204,.15)' : 'transparent',
    borderLeft: active(href) ? '2px solid var(--teal)' : '2px solid transparent',
    fontSize: 13, cursor: 'pointer', textDecoration: 'none', transition: 'all .15s',
  })

  const Icon = ({ d }: { d: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15, flexShrink: 0, opacity: .8 }}>
      <path d={d} />
    </svg>
  )

  return (
    <aside className="sidebar">
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="Skippair" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
          <div className="sidebar-label">
            <div style={{ color: 'white', fontSize: 15, fontWeight: 600 }}>Skippair</div>
            <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase' }}>Invoicing</div>
          </div>
        </div>
      </div>

      <nav style={{ padding: '12px 0', flex: 1 }}>
        <div className="sidebar-section-label" style={{ padding: '8px 16px 4px', fontSize: 10, color: 'rgba(255,255,255,.3)', letterSpacing: '1.2px', textTransform: 'uppercase', fontWeight: 500 }}>Main</div>
        {NAV.filter(n => n.roles.includes(profile.role)).map(n => (
          <Link key={n.href} href={n.href} style={itemStyle(n.href) as React.CSSProperties} className="sidebar-nav-item">
            <Icon d={n.icon} />
            <span className="sidebar-label">{n.label}</span>
          </Link>
        ))}
        {profile.role === 'admin' && (
          <>
            <div className="sidebar-section-label" style={{ padding: '16px 16px 4px', fontSize: 10, color: 'rgba(255,255,255,.3)', letterSpacing: '1.2px', textTransform: 'uppercase', fontWeight: 500 }}>Admin</div>
            {ADMIN_NAV.map(n => (
              <Link key={n.href} href={n.href} style={itemStyle(n.href) as React.CSSProperties} className="sidebar-nav-item">
                <Icon d={n.icon} />
                <span className="sidebar-label">{n.label}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'white', flexShrink: 0 }}>{initials}</div>
          <div className="sidebar-user-info" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'white', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.full_name}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>{profile.role}</div>
          </div>
          <button onClick={logout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer', padding: 4, flexShrink: 0 }} title="Sign out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
