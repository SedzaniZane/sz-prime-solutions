import type { NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' https://rhcpwraaobjuzgzvsoxr.supabase.co wss://rhcpwraaobjuzgzvsoxr.supabase.co${dev ? " ws: http://localhost:*" : ""}`,
    "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
    ...(!dev ? ["upgrade-insecure-requests"] : []),
  ].join('; ');
  const forwarded = new Headers(request.headers);
  forwarded.set('x-nonce', nonce);
  // Next.js reads this request header to attach the nonce to its own scripts.
  forwarded.set('Content-Security-Policy', policy);
  const response = await updateSession(request, forwarded);
  response.headers.set('Content-Security-Policy', policy);
  if (request.nextUrl.pathname.startsWith('/ops') || request.nextUrl.pathname.startsWith('/login')) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/yoco/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
