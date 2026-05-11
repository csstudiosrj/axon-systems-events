import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("portal_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { data: session } = await supabaseAdmin
      .from("portal_sessions")
      .select("employee_id, expires_at")
      .eq("token", token)
      .single();

    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
    }

    const body = await request.json() as {
      type: string;
      occurrence_date: string;
      days_count: number;
      description: string;
      attachment_url?: string | null;
    };

    const today = new Date().toISOString().slice(0, 10);
    if (body.occurrence_date > today) {
      return NextResponse.json({ error: "Data não pode ser futura." }, { status: 400 });
    }

    if (!body.description) {
      return NextResponse.json({ error: "Descrição é obrigatória." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("hr_occurrences").insert([{
      employee_id:     session.employee_id,
      type:            body.type,
      occurrence_date: body.occurrence_date,
      days_count:      body.days_count,
      description:     body.description,
      attachment_url:  body.attachment_url ?? null,
    }]);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro." },
      { status: 500 }
    );
  }
}