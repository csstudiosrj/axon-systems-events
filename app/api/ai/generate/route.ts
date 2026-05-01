import { NextResponse } from 'next/server';

export const runtime = 'edge'; // Otimizado para streaming na Vercel

export async function POST(request: Request) {
  try {
    const { mode, title, objective, niche, companyName, platforms } = await request.json();
    const apiKey = process.env.GOOGLE_GEMINI_API;

    if (!apiKey) {
      return NextResponse.json({ error: 'Chave ARXUM Mind nao configurada.' }, { status: 500 });
    }

    const modelId = 'gemini-2.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`;

    let prompt = "";

    if (mode === "brainstorm") {
      prompt = `Aja como Estrategista de Conteudo da empresa ${companyName} (${niche}). 
      Objetivo: ${objective}. 
      Tarefa: Sugira 5 temas de postagens para os canais ${platforms.join(", ")}. 
      Formato: Retorne apenas uma lista numerada com Título e Sugestão de Data.`;
    } else {
      prompt = `Aja como Redator de Marketing da ${companyName} (${niche}). 
      Tema: ${title}. Canais: ${platforms.join(", ")}.
      Tarefa: Escreva o conteudo completo para cada canal selecionado. 
      Tom: Profissional e luxuoso. Use emojis e hashtags.`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
      })
    });

    // Retorna o stream diretamente para o frontend
    return new Response(response.body, {
      headers: { 'Content-Type': 'text/event-stream' }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}