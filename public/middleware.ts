import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  // If no session, redirect to login – BUT exclude public assets
  if (!session) {
    const url = req.nextUrl.clone()
    // Allow these paths to bypass authentication
    const publicPaths = ['/manifest.json', '/sw.js', '/_next/static', '/_next/image', '/favicon.ico']
    if (publicPaths.some(path => url.pathname.startsWith(path))) {
      return res
    }
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return res
}

// Optionally, you can also use a matcher for better performance
export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js).*)',
}
