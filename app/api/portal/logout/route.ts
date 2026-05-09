import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("portal_token")?.value;

    if (token) {
      await supabaseAdmin.from("portal_sessions").delete().eq("token", token);
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set("portal_token", "", {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", expires: new Date(0), path: "/colaborador",
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro." }, { status: 500 });
  }
}