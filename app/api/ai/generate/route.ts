import { NextResponse } from "next/server";

export const runtime = "edge";
export const maxDuration = 60;

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface GenerateBody {
  mode: "suggestions" | "content";
  objective?: string;
  platforms?: string[];
  title?: string;
  companyName?: string;
  niche?: string;
}

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

interface AiSuggestion {
  title: string;
  date: string;
  time: string;
  rationale: string;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_GEMINI_API;
  if (!apiKey) {
    return NextResponse.json({ error: "Chave GOOGLE_GEMINI_API não configurada." }, { status: 500 });
  }

  let body: GenerateBody;
  try {
    body = await request.json() as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { mode, objective, title, companyName = "AXON", niche = "cliente", platforms = ["blog"] } = body;

  // ── Modo: sugestões de pauta ───────────────────────────────────────────────

  if (mode === "suggestions") {
    if (!objective) {
      return NextResponse.json({ error: "Campo 'objective' obrigatório." }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const platformList = platforms.join(", ");

    const prompt = `Você é um estrategista de conteúdo digital. Gere exatamente 5 sugestões de posts para a empresa "${companyName}" (nicho: ${niche}).

Objetivo da campanha: ${objective}
Plataformas: ${platformList}
Data base (hoje): ${today}

Retorne APENAS um JSON válido, sem markdown, sem texto antes ou depois. Formato exato:

{"suggestions":[{"title":"Título do post","date":"YYYY-MM-DD","time":"HH:MM","rationale":"Motivo em 1 frase"},{"title":"...","date":"...","time":"...","rationale":"..."}]}

Distribua as datas ao longo das próximas 4 semanas. Varie os horários entre 09:00, 12:00 e 18:00.`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ error: `Gemini error: ${errText}` }, { status: 502 });
      }

      const gemini = await res.json() as GeminiResponse;
      const raw = gemini.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const cleaned = raw.replace(/```json|```/g, "").trim();

      let parsed: { suggestions: AiSuggestion[] };
      try {
        parsed = JSON.parse(cleaned) as { suggestions: AiSuggestion[] };
      } catch {
        return NextResponse.json({ error: "Resposta da IA não é JSON válido.", raw }, { status: 502 });
      }

      return NextResponse.json(parsed);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erro inesperado." },
        { status: 500 }
      );
    }
  }

  // ── Modo: geração de conteúdo (streaming) ─────────────────────────────────

  if (mode === "content") {
    if (!title) {
      return NextResponse.json({ error: "Campo 'title' obrigatório." }, { status: 400 });
    }

    const platformList = platforms.join(", ");

    const prompt = `Escreva uma legenda de marketing para a empresa "${companyName}" (nicho: ${niche}).

Tema: ${title}
Plataformas de destino: ${platformList}

Regras obrigatórias:
- Comece DIRETAMENTE com o conteúdo. Não se apresente, não use frases como "Olá", "Como redator de...", "Com prazer" ou qualquer introdução.
- Tom profissional e envolvente.
- Use emojis com moderação.
- Inclua 3 a 5 hashtags relevantes no final.
- Se houver múltiplas plataformas, separe por seções com o nome da plataforma em negrito.
- Máximo de 300 palavras por plataforma.`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

    try {
      const geminiRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 2000 },
        }),
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        return NextResponse.json({ error: `Gemini error: ${errText}` }, { status: 502 });
      }

      return new Response(geminiRes.body, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erro inesperado." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Modo inválido. Use 'suggestions' ou 'content'." }, { status: 400 });
}