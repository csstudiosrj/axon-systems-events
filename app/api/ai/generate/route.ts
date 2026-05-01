import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, niche, companyName } = body;

    const apiKey = process.env.GOOGLE_GEMINI_API;

    if (!apiKey) {
      console.error("ERRO_ARXUM_AI: Variavel GOOGLE_GEMINI_API nao localizada.");
      return NextResponse.json(
        { error: 'Configuracao de API ausente no servidor.' },
        { status: 500 }
      );
    }

    // ID do modelo atualizado para a versao 2.0 conforme seu catalogo atual
    const modelId = 'gemini-2.0-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    const prompt = `Atue como especialista em marketing digital. 
    Empresa: ${companyName}, atuando no nicho de ${niche}. 
    Tema: ${title}. 
    Tarefa: Gere um post de blog curto e uma legenda de Instagram persuasiva. 
    Requisitos: Linguagem profissional, direta e luxuosa. Sem cliches. 
    Formatacao: Separe os dois conteudos com uma linha de asteriscos.`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("ERRO_API_GOOGLE_DETALHADO:", JSON.stringify(data));
      return NextResponse.json(
        { error: data.error?.message || 'Falha na resposta do provedor de IA.' },
        { status: response.status }
      );
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      return NextResponse.json(
        { error: 'A IA retornou um formato de dados inesperado.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ content: aiText });
  } catch (error: any) {
    console.error("ERRO_INTERNO_AI_ROUTE:", error.message);
    return NextResponse.json(
      { error: 'Falha interna no processamento da inteligencia artificial.' },
      { status: 500 }
    );
  }
}