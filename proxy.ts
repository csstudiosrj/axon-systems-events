import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Só protege rotas do portal do colaborador
  if (!pathname.startsWith("/colaborador")) return NextResponse.next();

  // Login não precisa de autenticação
  if (pathname === "/colaborador/login") return NextResponse.next();

  const token = request.cookies.get("portal_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/colaborador/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/colaborador/:path*"],
};