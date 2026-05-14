import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isDevelopment = process.env.NODE_ENV !== "production";

const createNonce = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
};

function buildCsp(nonce?: string) {
  const scriptSrc = isDevelopment
    ? `'self' 'unsafe-eval' 'unsafe-inline'`
    : nonce
      ? `'self' 'nonce-${nonce}'`
      : `'self'`;

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
  const nonce = isDevelopment ? undefined : createNonce();
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);

  if (nonce) {
    requestHeaders.set("x-nonce", nonce);
  }
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
