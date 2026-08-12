import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), browsing-topics=()");
  if (process.env.VERCEL_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return response;
}

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
      return applySecurityHeaders(NextResponse.redirect(url));
    }
  }

  const response = await updateSession(request);
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
