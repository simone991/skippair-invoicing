import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options as Record<string, string>))
        },
      },
    }
  )

  const allCookies = request.cookies.getAll()
  const authCookies = allCookies.filter(c => c.name.includes('auth') || c.name.includes('sb-'))
  console.log('[middleware] path:', request.nextUrl.pathname)
  console.log('[middleware] auth cookies:', JSON.stringify(authCookies.map(c => c.name)))
  console.log('[middleware] SUPABASE_URL set:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)

  const { data: { user } } = await supabase.auth.getUser()
  console.log('[middleware] user:', user?.id ?? 'null')

  const { pathname } = request.nextUrl
  const publicPaths = ['/auth/login', '/auth/reset-password']
  const isPublic = publicPaths.some(p => pathname.startsWith(p))

  if (!user && !isPublic && !pathname.startsWith('/api/generate-pdf')) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }
  if (user && pathname === '/') {
    const dashUrl = request.nextUrl.clone()
    dashUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashUrl)
  }
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
