import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, niche, companyName } = body;

    const apiKey = process.env.GOOGLE_GEMINI_API;

    if (!apiKey) {
      console.error("ERRO_ARXUM_AI: Variavel GOOGLE_GEMINI_API nao localizada no ambiente.");
      return NextResponse.json(
        { error: 'Configuracao de API ausente no servidor.' },
        { status: 500 }
      );
    }

    // Alterado de v1beta para v1 para garantir compatibilidade com o modelo flash
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Atue como especialista em marketing digital. 
    Empresa: ${companyName}. Nicho: ${niche}. 
    Tema: ${title}. 
    Tarefa: Gere um post de blog e uma legenda de Instagram. 
    Linguagem: Profissional, direta e luxuosa. 
    Formatacao: Separe os dois conteudos com uma linha de asteriscos.`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
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
        { error: 'A IA retornou um corpo de texto vazio.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ content: aiText });
  } catch (error: any) {
    console.error("ERRO_EXECUCAO_AI_ROUTE:", error.message);
    return NextResponse.json(
      { error: 'Erro interno no processamento da requisicao de IA.' },
      { status: 500 }
    );
  }
}