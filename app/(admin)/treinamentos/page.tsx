"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { PlaySquare, Plus, Loader2, ArrowLeft, Image as ImageIcon, Save, Trash2, Edit, Video, ListVideo } from "lucide-react";

export default function TreinamentosAdminPage() {
  const [view, setView] = useState<"list" | "course_form" | "lessons_manager">("list");
  const [courses, setCourses] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const[loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados do Curso
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const[targetAudience, setTargetAudience] = useState("all");
  const [status, setStatus] = useState("draft");

  // Estados da Aula
  const [lessonId, setLessonId] = useState<string | null>(null);
  const[lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [orderIndex, setOrderIndex] = useState("1");

  useEffect(() => {
    if (view === "list") fetchCourses();
    if (view === "lessons_manager" && activeCourseId) fetchLessons(activeCourseId);
  }, [view, activeCourseId]);

  const fetchCourses = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
    if (!error && data) setCourses(data);
    setLoading(false);
  };

  const fetchLessons = async (courseId: string) => {
    setLoading(true);
    const { data, error } = await supabase.from("lessons").select("*").eq("course_id", courseId).order("order_index", { ascending: true });
    if (!error && data) setLessons(data);
    setLoading(false);
  };

  const resetCourseForm = () => {
    setActiveCourseId(null);
    setTitle("");
    setDescription("");
    setThumbnailUrl("");
    setTargetAudience("all");
    setStatus("draft");
  };

  const resetLessonForm = () => {
    setLessonId(null);
    setLessonTitle("");
    setLessonDescription("");
    setVideoUrl("");
    setDurationMinutes("");
    setOrderIndex((lessons.length + 1).toString());
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setIsSubmitting(true);

    const payload = { title, description, thumbnail_url: thumbnailUrl, target_audience: targetAudience, status };
    let error;

    if (activeCourseId) {
      const { error: updateError } = await supabase.from("courses").update(payload).eq("id", activeCourseId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from("courses").insert([payload]);
      error = insertError;
    }

    if (!error) {
      resetCourseForm();
      setView("list");
    } else {
      alert("Erro ao salvar curso: " + error.message);
    }
    setIsSubmitting(false);
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle || !videoUrl || !activeCourseId) return;
    setIsSubmitting(true);

    const payload = { 
      course_id: activeCourseId, 
      title: lessonTitle, 
      description: lessonDescription, 
      video_url: videoUrl, 
      duration_minutes: Number(durationMinutes) || 0,
      order_index: Number(orderIndex) 
    };
    
    let error;

    if (lessonId) {
      const { error: updateError } = await supabase.from("lessons").update(payload).eq("id", lessonId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from("lessons").insert([payload]);
      error = insertError;
    }

    if (!error) {
      resetLessonForm();
      fetchLessons(activeCourseId);
    } else {
      alert("Erro ao salvar aula: " + error.message);
    }
    setIsSubmitting(false);
  };

  const handleDeleteCourse = async (id: string) => {
    if (!window.confirm("Excluir este curso apagará todas as aulas vinculadas. Deseja continuar?")) return;
    await supabase.from("courses").delete().eq("id", id);
    fetchCourses();
  };

  const handleDeleteLesson = async (id: string) => {
    if (!window.confirm("Excluir esta aula?")) return;
    await supabase.from("lessons").delete().eq("id", id);
    if (activeCourseId) fetchLessons(activeCourseId);
  };

  const openCourseEdit = (course: any) => {
    setActiveCourseId(course.id);
    setTitle(course.title);
    setDescription(course.description || "");
    setThumbnailUrl(course.thumbnail_url || "");
    setTargetAudience(course.target_audience);
    setStatus(course.status);
    setView("course_form");
  };

  const openLessonsManager = (course: any) => {
    setActiveCourseId(course.id);
    setTitle(course.title);
    setView("lessons_manager");
  };

  const editLesson = (lesson: any) => {
    setLessonId(lesson.id);
    setLessonTitle(lesson.title);
    setLessonDescription(lesson.description || "");
    setVideoUrl(lesson.video_url);
    setDurationMinutes(lesson.duration_minutes?.toString() || "");
    setOrderIndex(lesson.order_index.toString());
  };

  if (view === "course_form") {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <button onClick={() => { resetCourseForm(); setView("list"); }} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
          <ArrowLeft size={20} /> Voltar para o Catálogo
        </button>

        <div className="bg-surface border border-surface/50 p-6 rounded-lg flex flex-col md:flex-row gap-8">
          <div className="flex-1 space-y-6">
            <h3 className="text-lg font-medium text-white flex items-center gap-2 border-b border-surface/50 pb-4">
              <PlaySquare className="text-cs-green" size={20} />
              {activeCourseId ? "Editar Curso" : "Criar Novo Curso"}
            </h3>
            
            <form onSubmit={handleSaveCourse} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Título do Curso *</label>
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Descrição (Sinopse)</label>
                <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">URL da Capa (Thumbnail Vertical)</label>
                <input type="url" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Público Alvo (Acesso)</label>
                  <select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors">
                    <option value="internal">Apenas Equipe Interna (Staff)</option>
                    <option value="external">Apenas Clientes (Operadores)</option>
                    <option value="subscriber">Apenas Assinantes Avulsos</option>
                    <option value="all">Público Geral (Todos)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors">
                    <option value="draft">Rascunho (Invisível)</option>
                    <option value="published">Publicado (Disponível)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-surface/50">
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-8 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {activeCourseId ? "Atualizar Curso" : "Salvar Curso"}
                </button>
              </div>
            </form>
          </div>

          <div className="w-full md:w-64 shrink-0">
            <h4 className="text-sm font-medium text-text-secondary mb-4 uppercase tracking-wider">Preview da Capa</h4>
            <div className="w-full aspect-[2/3] bg-background border border-surface/50 rounded-md overflow-hidden relative group">
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="Capa" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-surface/50 p-4 text-center">
                  <ImageIcon size={48} className="mb-2" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-4">
                <h5 className="text-white font-bold leading-tight">{title || "Título do Curso"}</h5>
                <p className="text-[10px] text-cs-green font-medium mt-1 uppercase">{targetAudience}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "lessons_manager") {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <button onClick={() => { setView("list"); setActiveCourseId(null); }} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} /> Voltar para o Catálogo
          </button>
          <h2 className="text-xl font-bold text-white">Gerenciando: <span className="text-cs-green">{title}</span></h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-surface border border-surface/50 p-6 rounded-lg h-fit sticky top-6">
            <h3 className="text-md font-medium text-white mb-4 flex items-center gap-2">
              <Video className="text-cs-gold" size={18} />
              {lessonId ? "Editar Episódio" : "Adicionar Episódio"}
            </h3>
            <form onSubmit={handleSaveLesson} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Ordem (Nº)</label>
                  <input type="number" min="1" required value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Duração (Minutos)</label>
                  <input type="number" min="0" required value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors text-sm" placeholder="Ex: 15" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Título da Aula *</label>
                <input type="text" required value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Link do Vídeo (Vimeo/YouTube) *</label>
                <input type="url" required value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Resumo (Opcional)</label>
                <textarea rows={3} value={lessonDescription} onChange={(e) => setLessonDescription(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors resize-none text-sm" />
              </div>
              
              <div className="pt-2 flex gap-2">
                {lessonId && (
                  <button type="button" onClick={resetLessonForm} className="flex-1 py-2 text-xs font-medium text-text-secondary hover:text-white transition-colors border border-surface rounded-md">
                    Cancelar
                  </button>
                )}
                <button type="submit" disabled={isSubmitting} className="flex-1 flex justify-center items-center gap-2 rounded-md bg-cs-green py-2 text-xs font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                  {lessonId ? "Atualizar" : "Adicionar"}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 bg-surface border border-surface/50 rounded-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-surface/50 bg-background/50">
              <h3 className="text-md font-medium text-white flex items-center gap-2">
                <ListVideo className="text-text-secondary" size={18} /> Grade de Episódios
              </h3>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar max-h-[600px]">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-cs-green" size={24} /></div>
              ) : lessons.length === 0 ? (
                <p className="text-center text-text-secondary py-8 text-sm">Nenhuma aula cadastrada neste curso.</p>
              ) : (
                lessons.map((lesson) => (
                  <div key={lesson.id} className="flex items-center gap-4 bg-background border border-surface/50 p-3 rounded-md hover:border-cs-green/30 transition-colors group">
                    <div className="w-10 h-10 rounded bg-surface flex items-center justify-center text-lg font-bold text-text-secondary shrink-0">
                      {lesson.order_index}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">{lesson.title}</h4>
                      <p className="text-xs text-text-secondary truncate mt-0.5">{lesson.duration_minutes} min • {lesson.video_url}</p>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => editLesson(lesson)} className="p-1.5 text-text-secondary hover:text-cs-gold transition-colors rounded bg-surface"><Edit size={14} /></button>
                      <button onClick={() => handleDeleteLesson(lesson.id)} className="p-1.5 text-text-secondary hover:text-red-500 transition-colors rounded bg-surface"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <PlaySquare className="text-cs-green" size={20} />
          Estúdio de Criação (Treinamentos)
        </h3>
        <button onClick={() => { resetCourseForm(); setView("course_form"); }} className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all">
          <Plus size={18} /> Novo Curso
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-cs-green" size={32} /></div>
      ) : courses.length === 0 ? (
        <div className="text-center py-12 bg-surface border border-surface/50 rounded-lg">
          <PlaySquare size={48} className="mx-auto text-surface/50 mb-4" />
          <p className="text-text-secondary">Seu catálogo está vazio. Crie o primeiro curso para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {courses.map((course) => (
            <div key={course.id} className="group relative flex flex-col">
              <div className="w-full aspect-[2/3] bg-surface rounded-md overflow-hidden relative shadow-lg mb-3 border border-surface/50 group-hover:border-cs-green/50 transition-colors">
                {course.thumbnail_url ? (
                  <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-surface/50"><ImageIcon size={32} /></div>
                )}
                
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                  <button onClick={() => openLessonsManager(course)} className="bg-cs-green text-white px-4 py-2 rounded text-xs font-bold w-32 flex items-center justify-center gap-2 hover:bg-opacity-80 transition-colors">
                    <ListVideo size={14} /> Episódios
                  </button>
                  <button onClick={() => openCourseEdit(course)} className="bg-surface text-white px-4 py-2 rounded text-xs font-bold w-32 flex items-center justify-center gap-2 hover:bg-opacity-80 transition-colors">
                    <Edit size={14} /> Editar Capa
                  </button>
                  <button onClick={() => handleDeleteCourse(course.id)} className="bg-red-500/80 text-white px-4 py-2 rounded text-xs font-bold w-32 flex items-center justify-center gap-2 hover:bg-red-500 transition-colors mt-2">
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>

                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${course.status === 'published' ? 'bg-cs-green text-white' : 'bg-gray-500 text-white'}`}>
                    {course.status === 'published' ? 'Publicado' : 'Rascunho'}
                  </span>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-bold text-white leading-tight line-clamp-2 group-hover:text-cs-green transition-colors">{course.title}</h4>
                <p className="text-[10px] text-text-secondary mt-1 uppercase tracking-wider">
                  {course.target_audience === 'internal' ? 'Staff' : course.target_audience === 'external' ? 'Cliente' : course.target_audience === 'subscriber' ? 'Assinante' : 'Geral'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}