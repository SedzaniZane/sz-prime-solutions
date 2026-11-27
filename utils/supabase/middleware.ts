import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function updateSession(request: NextRequest, forwardedHeaders: Headers = request.headers) {
  let response = NextResponse.next({ request: { headers: forwardedHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          forwardedHeaders.set("cookie", request.cookies.toString());
          response = NextResponse.next({ request: { headers: forwardedHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (request.nextUrl.pathname.startsWith("/ops") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (request.nextUrl.pathname.startsWith("/ops") && user) {
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) return NextResponse.redirect(new URL("/login/mfa", request.url));
    if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
      return NextResponse.redirect(new URL("/login/mfa", request.url));
    }
    const { data: active, error } = await supabase.rpc("is_active_staff");
    if (error || active !== true) return NextResponse.redirect(new URL("/access-denied", request.url));
  }

  if (request.nextUrl.pathname === "/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/ops";
    return NextResponse.redirect(url);
  }

  return response;
}
