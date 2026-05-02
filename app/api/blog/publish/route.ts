import { NextResponse } from "next/server";
 
export const runtime = "edge";
 
// ─── Tipos ────────────────────────────────────────────────────────────────────
 
interface PublishBody {
  id: string;
  title: string;
  content: string;
  slug: string;
  image_url?: string | null;
  published_at?: string;
  platforms?: string[];
}
 
// ─── Handler ──────────────────────────────────────────────────────────────────
 
/**
 * POST /api/blog/publish
 *
 * Envia o post para o blog do cliente (Next.js) via webhook.
 * O blog do cliente deve ter uma rota /api/posts/receive que aceite
 * a chave BLOG_WEBHOOK_SECRET no header Authorization.
 *
 * Variáveis de ambiente necessárias:
 *   BLOG_WEBHOOK_URL    → URL completa do endpoint do blog
 *   BLOG_WEBHOOK_SECRET → Token compartilhado para autenticação
 */
export async function POST(request: Request) {
  const webhookUrl    = process.env.BLOG_WEBHOOK_URL;
  const webhookSecret = process.env.BLOG_WEBHOOK_SECRET;
 
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "BLOG_WEBHOOK_URL não configurada. Adicione nas variáveis de ambiente." },
      { status: 500 }
    );
  }
 
  let body: PublishBody;
  try {
    body = await request.json() as PublishBody;
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }
 
  const { id, title, content, slug, image_url, published_at, platforms } = body;
 
  if (!id || !title || !slug) {
    return NextResponse.json({ error: "Campos obrigatórios: id, title, slug." }, { status: 400 });
  }
 
  const payload = {
    id,
    title,
    content,
    slug,
    image_url:    image_url ?? null,
    published_at: published_at ?? new Date().toISOString(),
    platforms:    platforms ?? ["blog"],
  };
 
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookSecret ? { Authorization: `Bearer ${webhookSecret}` } : {}),
      },
      body: JSON.stringify(payload),
    });
 
    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: `Blog recusou a publicação: ${detail}` },
        { status: 502 }
      );
    }
 
    return NextResponse.json({ ok: true, slug, published_at: payload.published_at });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao chamar o webhook do blog." },
      { status: 500 }
    );
  }
}
 