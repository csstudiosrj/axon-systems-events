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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "rh/uploads";

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const sanitized = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .toLowerCase();

    const path = `${folder}/${Date.now()}-${sanitized}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabaseAdmin.storage
      .from("axon-assets")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) throw error;

    const { data } = supabaseAdmin.storage
      .from("axon-assets")
      .getPublicUrl(path);

    return NextResponse.json({ url: data.publicUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro no upload." },
      { status: 500 }
    );
  }
}