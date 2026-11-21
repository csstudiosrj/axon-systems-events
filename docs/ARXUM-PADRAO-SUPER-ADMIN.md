# Padrão de Super Admin ARXUM (Admin Kit)

Atualizado em 19/11/2026. Vale para todos os produtos ARXUM.

## Regra de implementação

- **Quando o código listado em "Neste produto" for tocado, implemente o item correspondente do padrão na mesma entrega.** Não espere uma fase própria de migração.
- A migração anda **em paralelo** ao trabalho em curso, sempre que fizer sentido. Item pequeno e do mesmo assunto entra no mesmo PR. Item que mexe em banco, acesso ou cobrança vai em PR separado.
- A migração nunca bloqueia a entrega original e não vira uma "grande migração". O objetivo agora é **padronizar**, não unificar: cada produto mantém o próprio banco.
- Se o item exigir uma decisão do dono (dependência nova, mudança grande, cobrança), pare e pergunte antes. Siga as regras do `CLAUDE.md` deste repositório.

## O padrão em resumo

- O super admin é identificado por uma tabela própria da plataforma, nunca por texto livre nem por dado vindo do cliente. A conferência é sempre no servidor.
- Quatro papéis fixos: super admin, suporte, financeiro e somente leitura.
- Toda ação de super admin passa por uma única função no servidor, que confere o papel e grava o evento de auditoria. Formato do evento: `entidade.acao`, com quem, quando, alvo e detalhes.
- Tabelas com prefixo `admin_*`, nomes em inglês, `uuid` e coluna `product_slug`. A versão do kit fica em `admin_kit_meta`.
- O kit nunca lê as tabelas do produto direto. O produto mapeia o próprio "tenant" (escola, empresa, produtora, conta...) por um adaptador com nome, slug, status, plano, vencimento, observação do admin, suspensão e se é demonstração.
- A chave de servidor do Supabase (service role) só existe no servidor.
- No banco: nenhuma função `SECURITY DEFINER` chamável por visitantes sem necessidade, `search_path` fixo em toda função e proteção contra senha vazada ligada no Auth.

O checklist completo (15 módulos, 85 itens) e as fases do plano estão no documento "Padrão de Super Admin ARXUM — Checklist e Plano de Implementação", que o dono mantém na conta Claude dele.

## Neste produto

**ARXUM Suite** não tem área de super admin: o papel `super_admin` só filtra o menu na tela. O kit entra aqui do zero.

Gatilhos (mexeu aqui, implemente junto):
- `app/(admin)/layout.tsx` e as telas de equipe: o acesso e o papel devem ser conferidos no servidor, nunca só na tela.
- Toda rota em `app/api/*` que usa a chave de servidor do Supabase: exigir sessão e derivar empresa e papel do usuário logado. Nunca aceitar `company_id` ou papel vindos do corpo da requisição.
- Qualquer SQL novo: RLS ligado e funções sem acesso de visitante por padrão.

## Registro de correções (20/11/2026)

Feito (PR #3 e migração `20261120_01_fecha_funcoes_expostas`):
- Rotas `/api/invite`, `/api/finance/send-invoice`, `/api/ai/generate` e `/api/blog/publish` exigem sessão; papel, empresa e cliente vêm do banco (`app/lib/authServer.ts`). As telas usam `app/lib/authFetch.ts`.
- Banco: funções-gatilho e `handle_new_user` fechadas para visitantes e usuários logados; `search_path` fixo nas 13 funções; `get_company_id` só para usuário logado; funções novas nascem sem acesso de visitante.

Pendente (decisão ou ação manual):
- 25 tabelas com RLS ligado e sem política (ficam travadas para o navegador). Antes de ter clientes reais, escrever as políticas por `company_id` e por papel, incluindo o acesso do portal do cliente.
- Ligar a proteção contra senha vazada em Auth do painel do Supabase (não há como ligar por SQL).
- `/api/portal/company` e `/api/leads` são públicos de propósito (branding da tela de login; formulário por token).
- Ainda não existe área de super admin nem tabelas `admin_*`: o kit entra do zero.
