import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("ai_chat_session")?.value;
  const { pathname } = request.nextUrl;

  if ((pathname === "/" || pathname.startsWith("/admin")) && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*"],
};
