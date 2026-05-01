import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { title, niche, companyName } = await request.json();

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Credenciais de inteligência artificial não localizadas no servidor.' },
        { status: 500 }
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Aja como um especialista em marketing digital. 
    Contexto: Empresa ${companyName}, atuando no nicho de ${niche}.
    Tarefa: Escreva um post de blog curto e uma legenda persuasiva para Instagram sobre o tema: "${title}".
    Requisitos: Use um tom de voz luxuoso, profissional e pragmático. Não use clichês.
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
      throw new Error(data.error?.message || 'Falha na comunicação com o provedor de IA.');
    }

    const aiContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiContent) {
      throw new Error('O provedor de IA retornou um conteúdo vazio ou inválido.');
    }

    return NextResponse.json({ content: aiContent });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}