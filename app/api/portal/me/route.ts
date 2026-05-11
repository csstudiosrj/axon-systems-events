import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
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
      if (session) await supabaseAdmin.from("portal_sessions").delete().eq("token", token);
      return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
    }

    const { data: emp } = await supabaseAdmin
      .from("hr_employee_details")
      .select("id,full_name,role_label,email,phone,document_cpf,hiring_date,contract_type,base_salary,vt_value,va_value,vr_value,health_plan_value,dental_plan_value,insurance_value,commission_rate,pix_key,bank_info")
      .eq("id", session.employee_id)
      .single();

    if (!emp) {
      return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });
    }

    const { data: payrolls } = await supabaseAdmin
      .from("hr_payrolls")
      .select("id,reference_month,reference_year,total_base_salary,total_benefits,total_commissions,total_reimbursements,total_deductions,inss_deduction,irrf_deduction,absence_discount,absence_days,final_net_value,status,confirmed_at")
      .eq("employee_id", session.employee_id)
      .order("reference_year", { ascending: false })
      .order("reference_month", { ascending: false });

    const { data: reimbursements } = await supabaseAdmin
      .from("hr_reimbursements")
      .select("id,description,amount,status,receipt_url,created_at,approved_at,rejection_reason,quote_id,service_order_id")
      .eq("employee_id", session.employee_id)
      .order("created_at", { ascending: false });

    const { data: occurrences } = await supabaseAdmin
      .from("hr_occurrences")
      .select("id,type,occurrence_date,days_count,description,attachment_url")
      .eq("employee_id", session.employee_id)
      .order("occurrence_date", { ascending: false });

    const { data: company } = await supabaseAdmin
      .from("company_profile")
      .select("company_name,logo_url,primary_color")
      .single();

    return NextResponse.json({
      employee: emp,
      payrolls: payrolls ?? [],
      reimbursements: reimbursements ?? [],
      occurrences: occurrences ?? [],
      company: company ?? {},
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro." }, { status: 500 });
  }
}