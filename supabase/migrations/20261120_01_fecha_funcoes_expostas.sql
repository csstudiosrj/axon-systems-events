-- Já aplicada em produção em 20/11/2026 (projeto epsynrqawzstuqfdxuuc). Idempotente.
do $$
declare f text;
begin
  foreach f in array array[
    'fn_notify_financial_event','fn_notify_hr_occurrence','fn_notify_hr_payroll',
    'fn_notify_hr_reimbursement','fn_notify_quote_status','fn_notify_ticket_message',
    'fn_notify_ticket_new','handle_new_user','set_current_timestamp_updated_at',
    'set_financial_transactions_updated_at','set_updated_at',
    'sync_financial_attachment_touch_parent','sync_financial_transaction_last_interaction'
  ] loop
    execute format('revoke execute on function public.%I() from public, anon, authenticated', f);
    execute format('alter function public.%I() set search_path = public', f);
  end loop;
end $$;

revoke execute on function public.get_company_id() from public, anon;
grant execute on function public.get_company_id() to authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;
