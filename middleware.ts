import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const protectedApiPrefixes = [
  '/api/admin',
  '/api/chats',
  '/api/connections',
  '/api/group-chats',
  '/api/openrouter',
  '/api/personas',
  '/api/profile',
  '/api/upload',
  '/api/users/badges',
]

function hasBearerToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  return !!authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 7
}

function requiresApiAuth(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!pathname.startsWith('/api/')) {
    return false
  }

  if (protectedApiPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return true
  }

  if (pathname.startsWith('/api/chat-rooms/')) {
    return true
  }

  if (pathname === '/api/chat-rooms' && req.method !== 'GET') {
    return true
  }

  if (pathname.startsWith('/api/narrative/')) {
    return true
  }

  return false
}

export async function middleware(req: NextRequest) {
  if (requiresApiAuth(req) && !hasBearerToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
