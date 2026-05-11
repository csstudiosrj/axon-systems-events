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
      description: string;
      amount: number;
      quote_id?: string | null;
      service_order_id?: string | null;
      receipt_url?: string | null;
    };

    if (!body.description || !body.amount) {
      return NextResponse.json({ error: "Descrição e valor são obrigatórios." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("hr_reimbursements").insert([{
      employee_id:      session.employee_id,
      description:      body.description,
      amount:           body.amount,
      quote_id:         body.quote_id ?? null,
      service_order_id: body.service_order_id ?? null,
      receipt_url:      body.receipt_url ?? null,
      status:           "pending_approval",
      batch_status:     "submitted",
      submitted_at:     new Date().toISOString(),
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