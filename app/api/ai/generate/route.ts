import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { title, niche, companyName } = await request.json();

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'Chave da API do Gemini não configurada no servidor.' }, { status: 500 });
    }

    // O modelo é selecionado aqui na URL: gemini-1.5-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Aja como um especialista em marketing digital. 
    Contexto: Empresa ${companyName}, atuando no nicho de ${niche}.
    Tarefa: Escreva um post de blog curto e uma legenda persuasiva para Instagram sobre o tema: "${title}".
    Requisitos: Use um tom de voz luxuoso, profissional e pragmático. Inclua emojis pertinentes e hashtags.
    Formatação: Separe o post do blog da legenda do Instagram com uma linha clara de asteriscos.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Erro na comunicação com o Gemini.');
    }

    // O Gemini retorna o texto neste caminho específico do JSON
    const aiContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiContent) {
      throw new Error('A IA não retornou conteúdo válido.');
    }

    return NextResponse.json({ content: aiContent });
  } catch (error: any) {
    console.error("🔥 Erro na API Route de IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}