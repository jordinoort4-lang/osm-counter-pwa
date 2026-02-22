import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  // Always allow these public paths
  const publicPaths = ['/manifest.json', '/sw.js', '/_next/static', '/_next/image', '/favicon.ico']
  if (publicPaths.some(path => req.nextUrl.pathname.startsWith(path))) {
    return res
  }

  // If no session, redirect to login
  if (!session) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return res
}

// Optional: improve performance by not running middleware on public paths at all
export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js).*)',
}
