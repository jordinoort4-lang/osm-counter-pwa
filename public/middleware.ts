import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  // No session → redirect to login (but only for non-public paths)
  if (!session) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return res
}

// 👇 This matcher tells Next.js to run middleware on all paths EXCEPT these
export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js).*)',
}
