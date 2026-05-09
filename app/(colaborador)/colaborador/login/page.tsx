import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function hashPassword(password: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(password).digest("hex");
}
function generateSalt(): string { return crypto.randomBytes(32).toString("hex"); }
function generateToken(): string { return crypto.randomBytes(48).toString("hex"); }
function cleanCPF(cpf: string): string { return cpf.replace(/\D/g, ""); }

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      cpf: string; password: string;
      newPassword?: string; isFirstAccess?: boolean;
    };
    const { cpf, password, newPassword, isFirstAccess } = body;

    if (!cpf || !password) {
      return NextResponse.json({ error: "CPF e senha são obrigatórios." }, { status: 400 });
    }

    const cpfClean = cleanCPF(cpf);
    if (cpfClean.length !== 11) {
      return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
    }

    // Formata o CPF para bater com o formato salvo no banco (000.000.000-00)
    const cpfFormatted = cpfClean
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/(\d{3})-?(\d{2})$/, "$1-$2");

    // Tenta encontrar com CPF formatado primeiro, depois limpo como fallback
    let { data: emp, error: empErr } = await supabaseAdmin
      .from("hr_employee_details")
      .select("id,full_name,document_cpf,status,portal_password_hash,portal_password_salt,portal_first_access,email")
      .eq("document_cpf", cpfFormatted)
      .eq("status", "active")
      .single();

    if (empErr || !emp) {
      const res2 = await supabaseAdmin
        .from("hr_employee_details")
        .select("id,full_name,document_cpf,status,portal_password_hash,portal_password_salt,portal_first_access,email")
        .eq("document_cpf", cpfClean)
        .eq("status", "active")
        .single();
      emp = res2.data;
      empErr = res2.error;
    }

    if (empErr || !emp) {
      return NextResponse.json({ error: "CPF não encontrado ou colaborador inativo." }, { status: 401 });
    }

    // Primeiro acesso
    if (emp.portal_first_access || !emp.portal_password_hash) {
      if (!isFirstAccess || !newPassword) {
        return NextResponse.json({ firstAccess: true }, { status: 200 });
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: "Senha mínima de 6 caracteres." }, { status: 400 });
      }
      const salt  = generateSalt();
      const hash  = hashPassword(newPassword, salt);
      const token = generateToken();
      const exp   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await supabaseAdmin.from("hr_employee_details").update({
        portal_password_hash: hash, portal_password_salt: salt,
        portal_first_access: false, portal_last_login: new Date().toISOString(),
      }).eq("id", emp.id);

      await supabaseAdmin.from("portal_sessions").insert([{ employee_id: emp.id, token, expires_at: exp }]);

      const res = NextResponse.json({ ok: true, employee: { id: emp.id, full_name: emp.full_name } });
      res.cookies.set("portal_token", token, {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "lax", expires: new Date(exp), path: "/colaborador",
      });
      return res;
    }

    // Acesso normal
    if (!emp.portal_password_hash || !emp.portal_password_salt) {
      return NextResponse.json({ firstAccess: true }, { status: 200 });
    }

    const hash = hashPassword(password, emp.portal_password_salt);
    if (hash !== emp.portal_password_hash) {
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    }

    const token = generateToken();
    const exp   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin.from("portal_sessions").insert([{ employee_id: emp.id, token, expires_at: exp }]);
    await supabaseAdmin.from("hr_employee_details").update({ portal_last_login: new Date().toISOString() }).eq("id", emp.id);

    const res = NextResponse.json({ ok: true, employee: { id: emp.id, full_name: emp.full_name } });
    res.cookies.set("portal_token", token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", expires: new Date(exp), path: "/colaborador",
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro inesperado." }, { status: 500 });
  }
}