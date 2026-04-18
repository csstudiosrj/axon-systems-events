"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { Loader2, ArrowLeft, PlayCircle, CheckCircle, BookOpen, Save, Clock } from "lucide-react";
import Link from "next/link";

export default function SalaDeAulaPage() {
  const params = useParams();
  const router = useRouter();
  
  const [course, setCourse] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const[activeLesson, setActiveLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Estados do Caderno do Aluno
  const [notes, setNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (params.id) {
      fetchCourseAndLessons(params.id as string);
    }
  }, [params.id]);

  const fetchCourseAndLessons = async (courseId: string) => {
    setLoading(true);
    
    // 1. Busca os dados do curso
    const { data: courseData } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .single();

    // 2. Busca todas as aulas deste curso
    const { data: lessonsData } = await supabase
      .from("lessons")
      .select("*")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });

    if (courseData) setCourse(courseData);
    
    if (lessonsData && lessonsData.length > 0) {
      setLessons(lessonsData);
      // Define a primeira aula como ativa por padrão
      setActiveLesson(lessonsData[0]);
      // Busca as anotações salvas desta aula (se houver)
      fetchUserProgress(lessonsData[0].id);
    }
    
    setLoading(false);
  };

  const fetchUserProgress = async (lessonId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("lesson_progress")
      .select("notes, is_completed")
      .eq("lesson_id", lessonId)
      .eq("user_id", session.user.id)
      .single();

    if (data && data.notes) {
      setNotes(data.notes);
    } else {
      setNotes("");
    }
  };

  const handleLessonChange = (lesson: any) => {
    setActiveLesson(lesson);
    setSaveMessage("");
    fetchUserProgress(lesson.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session && activeLesson) {
      // Usa upsert para criar ou atualizar o progresso do aluno nesta aula
      const { error } = await supabase
        .from("lesson_progress")
        .upsert({
          user_id: session.user.id,
          lesson_id: activeLesson.id,
          notes: notes,
          last_watched_at: new Date().toISOString()
        }, { onConflict: 'user_id, lesson_id' });

      if (!error) {
        setSaveMessage("Anotações salvas com sucesso!");
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        setSaveMessage("Erro ao salvar.");
      }
    }
    setIsSavingNotes(false);
  };

  // Função para converter links do YouTube/Vimeo em formato de Embed (Iframe)
  const getEmbedUrl = (url: string) => {
    if (!url) return "";
    if (url.includes("youtube.com/watch?v=")) {
      return url.replace("watch?v=", "embed/");
    }
    if (url.includes("youtu.be/")) {
      return url.replace("youtu.be/", "youtube.com/embed/");
    }
    if (url.includes("vimeo.com/")) {
      return url.replace("vimeo.com/", "player.vimeo.com/video/");
    }
    return url;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="animate-spin text-cs-green" size={48} />
      </div>
    );
  }

  if (!course || lessons.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background text-center px-4">
        <h2 className="text-2xl font-bold text-white mb-2">Conteúdo Indisponível</h2>
        <p className="text-text-secondary mb-6">Este curso ainda não possui aulas cadastradas.</p>
        <Link href="/portal/treinamentos" className="text-cs-green hover:underline">Voltar para a Academy</Link>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background min-h-screen flex flex-col">
      
      {/* Header Minimalista da Sala de Aula */}
      <div className="bg-surface border-b border-surface/50 p-4 sticky top-0 z-40 flex items-center gap-4">
        <Link href="/portal/treinamentos" className="text-text-secondary hover:text-white transition-colors p-2 bg-background rounded-full">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">{course.title}</h1>
          <p className="text-xs text-cs-green font-medium">LOC FIX Academy</p>
        </div>
      </div>

      <div className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row">
        
        {/* Lado Esquerdo: Player de Vídeo e Caderno */}
        <div className="flex-1 flex flex-col border-r border-surface/50">
          
          {/* Player de Vídeo (Proporção 16:9) */}
          <div className="w-full bg-black aspect-video relative">
            {activeLesson?.video_url ? (
              <iframe 
                src={getEmbedUrl(activeLesson.video_url)} 
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-surface/50">
                <PlayCircle size={64} className="mb-4" />
                <p>Vídeo indisponível</p>
              </div>
            )}
          </div>

          {/* Informações da Aula Atual */}
          <div className="p-6 md:p-8 bg-surface/30">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-cs-green/20 text-cs-green px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">
                Episódio {activeLesson?.order_index}
              </span>
              {activeLesson?.duration_minutes > 0 && (
                <span className="flex items-center gap-1 text-xs text-text-secondary font-medium">
                  <Clock size={12} /> {activeLesson.duration_minutes} min
                </span>
              )}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">{activeLesson?.title}</h2>
            <p className="text-text-secondary leading-relaxed max-w-4xl">
              {activeLesson?.description || "Nenhuma descrição fornecida para esta aula."}
            </p>
          </div>

          {/* Caderno do Aluno */}
          <div className="p-6 md:p-8 border-t border-surface/50 flex-1 bg-background">
            <div className="max-w-4xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BookOpen className="text-cs-gold" size={20} />
                  Caderno de Anotações
                </h3>
                {saveMessage && <span className="text-xs font-medium text-cs-green animate-pulse">{saveMessage}</span>}
              </div>
              
              <p className="text-sm text-text-secondary mb-4">
                Suas anotações são privadas e ficam salvas automaticamente nesta aula para você consultar depois.
              </p>
              
              <div className="relative">
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Digite suas anotações, atalhos ou dúvidas sobre esta aula aqui..."
                  className="w-full h-64 bg-surface border border-surface/50 rounded-lg p-4 text-white focus:border-cs-gold focus:ring-1 focus:ring-cs-gold focus:outline-none resize-none transition-colors custom-scrollbar leading-relaxed"
                />
                <button 
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="absolute bottom-4 right-4 bg-cs-gold text-black px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 hover:bg-opacity-90 transition-all disabled:opacity-50 shadow-lg"
                >
                  {isSavingNotes ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Salvar Anotações
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito: Playlist (Lista de Episódios) */}
        <div className="w-full lg:w-96 bg-surface flex flex-col h-[calc(100vh-73px)] lg:sticky lg:top-[73px]">
          <div className="p-6 border-b border-surface/50 shrink-0">
            <h3 className="text-lg font-bold text-white">Conteúdo do Curso</h3>
            <p className="text-xs text-text-secondary mt-1">{lessons.length} episódios disponíveis</p>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
            {lessons.map((lesson) => {
              const isActive = activeLesson?.id === lesson.id;
              
              return (
                <button
                  key={lesson.id}
                  onClick={() => handleLessonChange(lesson)}
                  className={`w-full text-left p-4 rounded-lg border transition-all flex gap-4 group ${
                    isActive 
                      ? 'bg-cs-green/10 border-cs-green/50' 
                      : 'bg-background border-surface/50 hover:border-text-secondary/50'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {isActive ? (
                      <PlayCircle size={20} className="text-cs-green fill-cs-green/20" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-text-secondary/50 flex items-center justify-center text-[10px] font-bold text-text-secondary group-hover:border-white group-hover:text-white transition-colors">
                        {lesson.order_index}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-medium truncate mb-1 transition-colors ${isActive ? 'text-cs-green' : 'text-white group-hover:text-cs-green'}`}>
                      {lesson.title}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-text-secondary">
                      {lesson.duration_minutes > 0 && (
                        <span className="flex items-center gap-1"><Clock size={10} /> {lesson.duration_minutes} min</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}