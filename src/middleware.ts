import { NextRequest, NextResponse } from "next/server";

const reserved = new Set(["guide", "about", "contact", "demo", "features", "free-trial", "login", "pricing", "payment", "super-admin", "school-admin", "teacher", "finance", "exam-staff", "receptionist", "parent", "api"]);

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const [, schoolSlug, portal, ...rest] = pathname.split("/");
  if (!schoolSlug || reserved.has(schoolSlug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(schoolSlug)) return NextResponse.next();

  if (portal === "login" && rest.length === 0) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/login";
    destination.searchParams.set("schoolSlug", schoolSlug);
    return NextResponse.rewrite(destination);
  }

  const aliases: Record<string, string> = { parent: "parent", admin: "school-admin", teacher: "teacher", staff: "receptionist", receptionist: "receptionist", finance: "finance", "exam-staff": "exam-staff" };
  const target = aliases[portal];
  if (!target) return NextResponse.next();
  const destination = request.nextUrl.clone();
  destination.pathname = `/${target}${rest.length ? `/${rest.join("/")}` : ""}`;
  for (const [key, value] of searchParams) if (!destination.searchParams.has(key)) destination.searchParams.set(key, value);
  return NextResponse.rewrite(destination);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"] };

