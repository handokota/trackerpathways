import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isDevelopment = process.env.NODE_ENV !== "production";

function buildCsp() {
  const scriptSrc = isDevelopment
    ? `'self' 'unsafe-eval' 'unsafe-inline'`
    : `'self' 'unsafe-inline'`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  response.headers.set("Content-Security-Policy", buildCsp());
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
