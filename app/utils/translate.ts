/**
 * ARXUM Systems — Utilitário de Tradução
 *
 * Centraliza a tradução de chaves de banco de dados, status e enums
 * para português. Importar onde necessário:
 *
 *   import { translateStatus, translateKey } from "@/app/utils/translate";
 */

// ─── Status financeiros ───────────────────────────────────────────────────────

const FINANCIAL_STATUS: Record<string, string> = {
    pending:           "Pendente",
    paid:              "Pago",
    received:          "Recebido",
    overdue:           "Vencido",
    cancelled:         "Cancelado",
    refunded:          "Estornado",
  };
  
  // ─── Status de workflow (financial_transactions) ──────────────────────────────
  
  const WORKFLOW_STATUS: Record<string, string> = {
    open:             "Em aberto",
    awaiting_client:  "Aguardando cliente",
    awaiting_finance: "Aguardando financeiro",
    under_review:     "Em análise",
    confirmed:        "Confirmado",
    disputed:         "Contestado",
    resolved:         "Resolvido",
    cancelled:        "Cancelado",
  };
  
  // ─── Status de disputa (financial_transactions) ───────────────────────────────
  
  const DISPUTE_STATUS: Record<string, string> = {
    open:         "Aberta",
    pending:      "Pendente",
    under_review: "Em análise",
    resolved:     "Resolvida",
    closed:       "Encerrada",
    none:         "Sem contestação",
  };
  
  // ─── Categorias de disputa ────────────────────────────────────────────────────
  
  const DISPUTE_CATEGORY: Record<string, string> = {
    amount_divergence:    "Valor divergente",
    duplicate_charge:     "Cobrança duplicada",
    service_not_delivered:"Serviço não entregue",
    wrong_due_date:       "Data incorreta",
    wrong_document:       "Documento incorreto",
    unknown_charge:       "Cobrança desconhecida",
    other:                "Outro",
  };
  
  // ─── Status de orçamentos (quotes) ───────────────────────────────────────────
  
  const QUOTE_STATUS: Record<string, string> = {
    draft:            "Rascunho",
    pending_approval: "Aguardando aprovação",
    negotiating:      "Em negociação",
    approved:         "Aprovado",
    postponed:        "Adiado",
    rejected:         "Recusado",
    cancelled:        "Cancelado",
  };
  
  // ─── Status de ordens de serviço (service_orders) ────────────────────────────
  
  const SERVICE_ORDER_STATUS: Record<string, string> = {
    draft:       "Rascunho",
    scheduled:   "Agendada",
    in_progress: "Em andamento",
    completed:   "Concluída",
    cancelled:   "Cancelada",
    on_hold:     "Em espera",
  };
  
  // ─── Status de RH (hr_payrolls, hr_reimbursements) ───────────────────────────
  
  const HR_PAYROLL_STATUS: Record<string, string> = {
    draft:  "Rascunho",
    closed: "Fechada",
    paid:   "Paga",
  };
  
  const HR_REIMBURSEMENT_STATUS: Record<string, string> = {
    pending_approval: "Aguardando aprovação",
    approved:         "Aprovado",
    rejected:         "Rejeitado",
    paid:             "Pago",
  };
  
  const HR_OCCURRENCE_TYPE: Record<string, string> = {
    absence:             "Falta",
    warning:             "Advertência",
    suspension:          "Suspensão",
    medical_certificate: "Atestado Médico",
    performance_review:  "Avaliação",
    other:               "Outro",
  };
  
  // ─── Status de colaboradores (hr_employee_details) ────────────────────────────
  
  const EMPLOYEE_STATUS: Record<string, string> = {
    active:   "Ativo",
    inactive: "Inativo",
  };
  
  // ─── Status de tickets (suporte) ─────────────────────────────────────────────
  
  const TICKET_STATUS: Record<string, string> = {
    open:        "Aberto",
    in_progress: "Em andamento",
    waiting:     "Aguardando cliente",
    resolved:    "Resolvido",
    closed:      "Fechado",
  };
  
  // ─── Status de leads (CRM) ────────────────────────────────────────────────────
  
  const LEAD_STATUS: Record<string, string> = {
    new:          "Novo",
    contacted:    "Contactado",
    qualified:    "Qualificado",
    proposal_sent:"Proposta enviada",
    negotiating:  "Negociando",
    won:          "Ganho",
    lost:         "Perdido",
  };
  
  // ─── Status de marketing posts ───────────────────────────────────────────────
  
  const MARKETING_STATUS: Record<string, string> = {
    draft:     "Rascunho",
    scheduled: "Agendado",
    published: "Publicado",
    failed:    "Falhou",
  };
  
  // ─── Métodos de pagamento ─────────────────────────────────────────────────────
  
  const PAYMENT_METHOD: Record<string, string> = {
    pix:          "PIX",
    boleto:       "Boleto",
    transferencia:"Transferência",
    transfer:     "Transferência",
    cartao:       "Cartão",
    credit_card:  "Cartão de Crédito",
    outro:        "Outro",
  };
  
  // ─── Tipos de contrato (RH) ───────────────────────────────────────────────────
  
  const CONTRACT_TYPE: Record<string, string> = {
    clt:        "CLT",
    pj:         "PJ",
    freelancer: "Freelancer",
    internship: "Estágio",
    temporary:  "Temporário",
  };
  
  // ─── Chaves de banco (datas, campos) ─────────────────────────────────────────
  
  const DB_KEY: Record<string, string> = {
    setup_start_date:    "Data de Montagem",
    setup_end_date:      "Término da Montagem",
    event_start_date:    "Início do Evento",
    event_end_date:      "Término do Evento",
    teardown_start_date: "Início da Desmontagem",
    teardown_end_date:   "Término da Desmontagem",
    due_date:            "Vencimento",
    payment_date:        "Data de Pagamento",
    created_at:          "Criado em",
    updated_at:          "Atualizado em",
    confirmed_at:        "Confirmado em",
    hiring_date:         "Data de Admissão",
    birth_date:          "Data de Nascimento",
    final_amount:        "Valor Total",
    base_salary:         "Salário Base",
    commission_rate:     "Taxa de Comissão",
    client_id:           "Cliente",
    salesperson_id:      "Responsável Comercial",
    company_id:          "Empresa",
    quote_id:            "Orçamento",
    service_order_id:    "Ordem de Serviço",
  };
  
  // ─── Tipos de eventos (financial_transaction_events) ─────────────────────────
  
  const EVENT_TYPE: Record<string, string> = {
    charge_created:           "Cobrança criada",
    payment_reported:         "Pagamento informado",
    payment_receipt_attached: "Comprovante anexado",
    dispute_opened:           "Contestação aberta",
    dispute_comment:          "Comentário da contestação",
    finance_comment:          "Comentário do financeiro",
    payment_confirmed:        "Pagamento confirmado",
    payment_rejected:         "Pagamento rejeitado",
    charge_adjusted:          "Cobrança ajustada",
    charge_cancelled:         "Cobrança cancelada",
    status_changed:           "Status alterado",
    resolution_added:         "Resolução registrada",
    attachment_added:         "Anexo incluído",
  };
  
  // ─── Roles de usuário ─────────────────────────────────────────────────────────
  
  const USER_ROLE: Record<string, string> = {
    super_admin: "Super Admin",
    admin:       "Administrador",
    commercial:  "Comercial",
    financial:   "Financeiro",
    logistics:   "Logística",
    training:    "Treinamentos",
    support:     "Suporte",
    client:      "Cliente",
    student:     "Estudante",
    subscriber:  "Assinante",
  };
  
  // ─── API pública ──────────────────────────────────────────────────────────────
  
  /**
   * Traduz um status financeiro.
   * @example translateFinancialStatus("pending") // "Pendente"
   */
  export function translateFinancialStatus(status: string | null | undefined): string {
    if (!status) return "-";
    return FINANCIAL_STATUS[status] ?? status;
  }
  
  /**
   * Traduz um status de workflow de transação financeira.
   * @example translateWorkflowStatus("under_review") // "Em análise"
   */
  export function translateWorkflowStatus(status: string | null | undefined): string {
    if (!status) return "Em aberto";
    return WORKFLOW_STATUS[status] ?? status;
  }
  
  /**
   * Traduz um status de disputa.
   * @example translateDisputeStatus("open") // "Aberta"
   */
  export function translateDisputeStatus(status: string | null | undefined): string {
    if (!status) return "-";
    return DISPUTE_STATUS[status] ?? status;
  }
  
  /**
   * Traduz uma categoria de disputa.
   * @example translateDisputeCategory("amount_divergence") // "Valor divergente"
   */
  export function translateDisputeCategory(category: string | null | undefined): string {
    if (!category) return "-";
    return DISPUTE_CATEGORY[category] ?? category;
  }
  
  /**
   * Traduz um status de orçamento.
   * @example translateQuoteStatus("pending_approval") // "Aguardando aprovação"
   */
  export function translateQuoteStatus(status: string | null | undefined): string {
    if (!status) return "-";
    return QUOTE_STATUS[status] ?? status;
  }
  
  /**
   * Traduz um status de ordem de serviço.
   * @example translateServiceOrderStatus("scheduled") // "Agendada"
   */
  export function translateServiceOrderStatus(status: string | null | undefined): string {
    if (!status) return "-";
    return SERVICE_ORDER_STATUS[status] ?? status;
  }
  
  /**
   * Traduz um status de folha de pagamento.
   */
  export function translatePayrollStatus(status: string | null | undefined): string {
    if (!status) return "-";
    return HR_PAYROLL_STATUS[status] ?? status;
  }
  
  /**
   * Traduz um status de reembolso.
   */
  export function translateReimbursementStatus(status: string | null | undefined): string {
    if (!status) return "-";
    return HR_REIMBURSEMENT_STATUS[status] ?? status;
  }
  
  /**
   * Traduz um tipo de ocorrência de RH.
   */
  export function translateOccurrenceType(type: string | null | undefined): string {
    if (!type) return "-";
    return HR_OCCURRENCE_TYPE[type] ?? type;
  }
  
  /**
   * Traduz um status de colaborador.
   */
  export function translateEmployeeStatus(status: string | null | undefined): string {
    if (!status) return "-";
    return EMPLOYEE_STATUS[status] ?? status;
  }
  
  /**
   * Traduz um status de ticket de suporte.
   */
  export function translateTicketStatus(status: string | null | undefined): string {
    if (!status) return "-";
    return TICKET_STATUS[status] ?? status;
  }
  
  /**
   * Traduz um status de lead do CRM.
   */
  export function translateLeadStatus(status: string | null | undefined): string {
    if (!status) return "-";
    return LEAD_STATUS[status] ?? status;
  }
  
  /**
   * Traduz um status de post de marketing.
   */
  export function translateMarketingStatus(status: string | null | undefined): string {
    if (!status) return "-";
    return MARKETING_STATUS[status] ?? status;
  }
  
  /**
   * Traduz um método de pagamento.
   * @example translatePaymentMethod("pix") // "PIX"
   */
  export function translatePaymentMethod(method: string | null | undefined): string {
    if (!method) return "-";
    return PAYMENT_METHOD[method] ?? method;
  }
  
  /**
   * Traduz um tipo de contrato de RH.
   */
  export function translateContractType(type: string | null | undefined): string {
    if (!type) return "-";
    return CONTRACT_TYPE[type] ?? type;
  }
  
  /**
   * Traduz uma chave de coluna do banco para rótulo legível.
   * @example translateKey("setup_start_date") // "Data de Montagem"
   */
  export function translateKey(key: string | null | undefined): string {
    if (!key) return "-";
    return DB_KEY[key] ?? key.replace(/_/g, " ");
  }
  
  /**
   * Traduz um tipo de evento de transação financeira.
   */
  export function translateEventType(type: string | null | undefined): string {
    if (!type) return "-";
    return EVENT_TYPE[type] ?? type;
  }
  
  /**
   * Traduz um role de usuário do sistema.
   * @example translateUserRole("super_admin") // "Super Admin"
   */
  export function translateUserRole(role: string | null | undefined): string {
    if (!role) return "-";
    return USER_ROLE[role] ?? role;
  }
  
  /**
   * Função genérica — tenta traduzir qualquer string conhecida.
   * Útil para tabelas dinâmicas onde o tipo de status não é conhecido
   * em tempo de compilação.
   */
  export function translateAny(value: string | null | undefined): string {
    if (!value) return "-";
    return (
      FINANCIAL_STATUS[value] ??
      WORKFLOW_STATUS[value]  ??
      DISPUTE_STATUS[value]   ??
      QUOTE_STATUS[value]     ??
      SERVICE_ORDER_STATUS[value] ??
      TICKET_STATUS[value]    ??
      LEAD_STATUS[value]      ??
      MARKETING_STATUS[value] ??
      HR_PAYROLL_STATUS[value]??
      PAYMENT_METHOD[value]   ??
      USER_ROLE[value]        ??
      DB_KEY[value]           ??
      value
    );
  }