import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const studentContext = request.cookies.get("curio_student_context")?.value;
  const pathname = request.nextUrl.pathname;

  if (studentContext) {
    const protectedAdultArea =
      pathname === "/dashboard" ||
      pathname.startsWith("/familia") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/professor");

    if (protectedAdultArea) {
      const url = request.nextUrl.clone();
      url.pathname = "/aluno/desbloquear-familia";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
