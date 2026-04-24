"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { 
  PlaySquare, Plus, Loader2, ArrowLeft, Image as ImageIcon, 
  Save, Trash2, Edit, Video, ListVideo, UploadCloud, X, CheckCircle, AlertTriangle 
} from "lucide-react";

// --- BLINDAGEM TYPESCRIPT ---
interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  target_audience: string;
  status: string;
}

interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description: string;
  video_url: string;
  duration_minutes: number;
  order_index: number;
}

interface Toast {
  type: "success" | "error";
  text: string;
}

interface ConfirmDialog {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

export default function TreinamentosAdminPage() {
  const[view, setView] = useState<"list" | "course_form" | "lessons_manager">("list");
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const[isSubmitting, setIsSubmitting] = useState(false);

  // UI States (Substituindo alerts nativos)
  const [toast, setToast] = useState<Toast>({ type: "success", text: "" });
  const [confirmModal, setConfirmModal] = useState<ConfirmDialog>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  // Estados do Curso
  const[activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const[title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const[targetAudience, setTargetAudience] = useState("all");
  const [status, setStatus] = useState("draft");
  
  // Estados de Upload de Imagem
  const [thumbnailUrl, setThumbnailUrl] = useState(""); // URL vinda do banco
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null); // Arquivo físico selecionado
  const [previewUrl, setPreviewUrl] = useState(""); // Preview local
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados da Aula
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const[orderIndex, setOrderIndex] = useState("1");

  useEffect(() => {
    if (view === "list") fetchCourses();
    if (view === "lessons_manager" && activeCourseId) fetchLessons(activeCourseId);
  }, [view, activeCourseId]);

  const showToast = (text: string, type: "success" | "error") => {
    setToast({ text, type });
    setTimeout(() => setToast({ type: "success", text: "" }), 4000);
  };

  const fetchCourses = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
    if (!error && data) setCourses(data as Course[]);
    setLoading(false);
  };

  const fetchLessons = async (courseId: string) => {
    setLoading(true);
    const { data, error } = await supabase.from("lessons").select("*").eq("course_id", courseId).order("order_index", { ascending: true });
    if (!error && data) setLessons(data as Lesson[]);
    setLoading(false);
  };

  const resetCourseForm = () => {
    setActiveCourseId(null);
    setTitle("");
    setDescription("");
    setThumbnailUrl("");
    setThumbnailFile(null);
    setPreviewUrl("");
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

  // Lida com a seleção da imagem no computador
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setThumbnailFile(file);
      setPreviewUrl(URL.createObjectURL(file)); // Gera o preview instantâneo
    }
  };

  // Motor de Upload para o Supabase Storage
  const uploadThumbnail = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `courses/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('axon-assets')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('axon-assets')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      showToast("O título do curso é obrigatório.", "error");
      return;
    }
    setIsSubmitting(true);

    try {
      let finalThumbnailUrl = thumbnailUrl;

      // Se o usuário selecionou uma nova imagem, faz o upload primeiro
      if (thumbnailFile) {
        finalThumbnailUrl = await uploadThumbnail(thumbnailFile);
      }

      const payload = { 
        title, 
        description, 
        thumbnail_url: finalThumbnailUrl, 
        target_audience: targetAudience, 
        status 
      };

      if (activeCourseId) {
        const { error } = await supabase.from("courses").update(payload).eq("id", activeCourseId);
        if (error) throw error;
        showToast("Curso atualizado com sucesso.", "success");
      } else {
        const { error } = await supabase.from("courses").insert([payload]);
        if (error) throw error;
        showToast("Curso criado com sucesso.", "success");
      }

      resetCourseForm();
      setView("list");
    } catch (error: any) {
      showToast(`Erro ao salvar curso: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle || !videoUrl || !activeCourseId) {
      showToast("Preencha título e link do vídeo.", "error");
      return;
    }
    setIsSubmitting(true);

    const payload = { 
      course_id: activeCourseId, 
      title: lessonTitle, 
      description: lessonDescription, 
      video_url: videoUrl, 
      duration_minutes: Number(durationMinutes) || 0,
      order_index: Number(orderIndex) 
    };
    
    try {
      if (lessonId) {
        const { error } = await supabase.from("lessons").update(payload).eq("id", lessonId);
        if (error) throw error;
        showToast("Episódio atualizado.", "success");
      } else {
        const { error } = await supabase.from("lessons").insert([payload]);
        if (error) throw error;
        showToast("Episódio adicionado.", "success");
      }
      resetLessonForm();
      fetchLessons(activeCourseId);
    } catch (error: any) {
      showToast(`Erro ao salvar aula: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteCourse = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Excluir Curso",
      message: "Esta ação apagará o curso e todas as aulas vinculadas a ele. Deseja continuar?",
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        const { error } = await supabase.from("courses").delete().eq("id", id);
        if (!error) {
          showToast("Curso excluído com sucesso.", "success");
          fetchCourses();
        } else {
          showToast("Erro ao excluir curso.", "error");
        }
      }
    });
  };

  const confirmDeleteLesson = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Excluir Episódio",
      message: "Tem certeza que deseja excluir esta aula?",
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        const { error } = await supabase.from("lessons").delete().eq("id", id);
        if (!error && activeCourseId) {
          showToast("Episódio excluído.", "success");
          fetchLessons(activeCourseId);
        } else {
          showToast("Erro ao excluir episódio.", "error");
        }
      }
    });
  };

  const openCourseEdit = (course: Course) => {
    setActiveCourseId(course.id);
    setTitle(course.title);
    setDescription(course.description || "");
    setThumbnailUrl(course.thumbnail_url || "");
    setPreviewUrl(course.thumbnail_url || ""); // Mostra a imagem atual no preview
    setThumbnailFile(null);
    setTargetAudience(course.target_audience);
    setStatus(course.status);
    setView("course_form");
  };

  const openLessonsManager = (course: Course) => {
    setActiveCourseId(course.id);
    setTitle(course.title);
    setView("lessons_manager");
  };

  const editLesson = (lesson: Lesson) => {
    setLessonId(lesson.id);
    setLessonTitle(lesson.title);
    setLessonDescription(lesson.description || "");
    setVideoUrl(lesson.video_url);
    setDurationMinutes(lesson.duration_minutes?.toString() || "");
    setOrderIndex(lesson.order_index.toString());
  };

  if (view === "course_form") {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12 relative">
        {toast.text && (
          <div className={`fixed bottom-6 right-6 z-[100] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border ${toast.type === 'success' ? 'bg-[#1a1413] border-cs-green text-cs-green' : 'bg-[#1a1413] border-red-500 text-red-500'}`}>
            {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
            <span className="text-sm font-bold">{toast.text}</span>
          </div>
        )}

        <button onClick={() => { resetCourseForm(); setView("list"); }} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
          <ArrowLeft size={20} /> Voltar para o Catálogo
        </button>

        <div className="bg-surface border border-surface/50 p-8 rounded-xl shadow-2xl flex flex-col md:flex-row gap-10">
          <div className="flex-1 space-y-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2 border-b border-surface/50 pb-4">
              <PlaySquare className="text-cs-green" size={24} />
              {activeCourseId ? "Editar Curso" : "Criar Novo Curso"}
            </h3>
            
            <form onSubmit={handleSaveCourse} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Título do Curso *</label>
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-4 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Descrição (Sinopse)</label>
                <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-4 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm resize-none" />
              </div>

              {/* UPLOAD DE IMAGEM */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Capa do Curso (Thumbnail)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                <div className="flex items-center gap-4">
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-background border border-surface/50 rounded-md text-sm font-bold text-white hover:border-cs-green transition-colors"
                  >
                    <UploadCloud size={18} className="text-cs-green" />
                    {previewUrl ? "Trocar Imagem" : "Selecionar Imagem"}
                  </button>
                  {previewUrl && (
                    <button 
                      type="button" 
                      onClick={() => { setThumbnailFile(null); setPreviewUrl(""); setThumbnailUrl(""); }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remover
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-text-secondary mt-2">Formato recomendado: Vertical (2:3) - JPG ou PNG até 2MB.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Público Alvo (Acesso)</label>
                  <select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-4 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm cursor-pointer">
                    <option value="internal">Apenas Equipe Interna (Staff)</option>
                    <option value="external">Apenas Clientes (Operadores)</option>
                    <option value="subscriber">Apenas Assinantes Avulsos</option>
                    <option value="all">Público Geral (Todos)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-4 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm cursor-pointer">
                    <option value="draft">Rascunho (Invisível)</option>
                    <option value="published">Publicado (Disponível)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-surface/50">
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-md bg-cs-green py-2.5 px-8 text-sm font-bold text-white shadow-lg hover:bg-opacity-90 transition-all disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {activeCourseId ? "Atualizar Curso" : "Salvar Curso"}
                </button>
              </div>
            </form>
          </div>

          {/* PREVIEW DA CAPA */}
          <div className="w-full md:w-72 shrink-0">
            <h4 className="text-sm font-bold text-text-secondary mb-4 uppercase tracking-wider">Preview da Capa</h4>
            <div className="w-full aspect-[2/3] bg-background border-2 border-dashed border-surface/50 rounded-xl overflow-hidden relative group flex flex-col items-center justify-center">
              {previewUrl ? (
                <img src={previewUrl} alt="Capa Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
              ) : (
                <div className="text-center p-6 text-surface/50">
                  <ImageIcon size={48} className="mx-auto mb-3" />
                  <p className="text-xs font-medium">Nenhuma imagem selecionada</p>
                </div>
              )}
              
              {previewUrl && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-5">
                  <h5 className="text-white font-bold leading-tight text-lg">{title || "Título do Curso"}</h5>
                  <p className="text-xs text-cs-green font-bold mt-1 uppercase tracking-wider">{targetAudience}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "lessons_manager") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto relative pb-12">
        {toast.text && (
          <div className={`fixed bottom-6 right-6 z-[100] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border ${toast.type === 'success' ? 'bg-[#1a1413] border-cs-green text-cs-green' : 'bg-[#1a1413] border-red-500 text-red-500'}`}>
            {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
            <span className="text-sm font-bold">{toast.text}</span>
          </div>
        )}

        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-surface border border-surface/50 rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{confirmModal.title}</h3>
              <p className="text-sm text-text-secondary mb-6">{confirmModal.message}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="flex-1 py-2 rounded-md border border-surface text-text-secondary hover:text-white hover:bg-background transition-colors font-medium text-sm">
                  Cancelar
                </button>
                <button onClick={confirmModal.onConfirm} className="flex-1 py-2 rounded-md bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors shadow-lg">
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button onClick={() => { setView("list"); setActiveCourseId(null); }} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} /> Voltar para o Catálogo
          </button>
          <h2 className="text-xl font-bold text-white">Gerenciando: <span className="text-cs-green">{title}</span></h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-surface border border-surface/50 p-6 rounded-xl shadow-lg h-fit sticky top-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-surface/50 pb-3">
              <Video className="text-cs-gold" size={20} />
              {lessonId ? "Editar Episódio" : "Adicionar Episódio"}
            </h3>
            <form onSubmit={handleSaveLesson} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Ordem (Nº)</label>
                  <input type="number" min="1" required value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Duração (Minutos)</label>
                  <input type="number" min="0" required value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="Ex: 15" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Título da Aula *</label>
                <input type="text" required value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Link do Vídeo (YouTube Não Listado) *</label>
                <input type="url" required value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="https://youtube.com/watch?v=..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Resumo (Opcional)</label>
                <textarea rows={3} value={lessonDescription} onChange={(e) => setLessonDescription(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none resize-none text-sm" />
              </div>
              
              <div className="pt-4 border-t border-surface/50 flex gap-3">
                {lessonId && (
                  <button type="button" onClick={resetLessonForm} className="flex-1 py-2.5 text-sm font-bold text-text-secondary hover:text-white transition-colors border border-surface/50 rounded-md bg-background">
                    Cancelar
                  </button>
                )}
                <button type="submit" disabled={isSubmitting} className="flex-1 flex justify-center items-center gap-2 rounded-md bg-cs-green py-2.5 text-sm font-bold text-white shadow-lg hover:bg-opacity-90 transition-all disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  {lessonId ? "Atualizar" : "Adicionar"}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 bg-surface border border-surface/50 rounded-xl shadow-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b border-surface/50 bg-background/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ListVideo className="text-text-secondary" size={20} /> Grade de Episódios
              </h3>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto custom-scrollbar max-h-[600px]">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-cs-green" size={32} /></div>
              ) : lessons.length === 0 ? (
                <div className="text-center py-12">
                  <ListVideo size={48} className="mx-auto text-surface/50 mb-4" />
                  <p className="text-text-secondary font-medium">Nenhuma aula cadastrada neste curso.</p>
                </div>
              ) : (
                lessons.map((lesson) => (
                  <div key={lesson.id} className="flex items-center gap-4 bg-background border border-surface/50 p-4 rounded-lg hover:border-cs-green/50 transition-colors group shadow-sm">
                    <div className="w-12 h-12 rounded-md bg-surface flex items-center justify-center text-xl font-extrabold text-text-secondary shrink-0 group-hover:text-cs-green transition-colors">
                      {lesson.order_index}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-bold text-white truncate">{lesson.title}</h4>
                      <p className="text-xs text-text-secondary truncate mt-1">{lesson.duration_minutes} min • {lesson.video_url}</p>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => editLesson(lesson)} className="p-2 text-text-secondary hover:text-cs-gold transition-colors rounded-md bg-surface border border-surface/50 hover:border-cs-gold/30"><Edit size={16} /></button>
                      <button onClick={() => confirmDeleteLesson(lesson.id)} className="p-2 text-text-secondary hover:text-red-500 transition-colors rounded-md bg-surface border border-surface/50 hover:border-red-500/30"><Trash2 size={16} /></button>
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
    <div className="space-y-6 relative">
      {toast.text && (
        <div className={`fixed bottom-6 right-6 z-[100] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border ${toast.type === 'success' ? 'bg-[#1a1413] border-cs-green text-cs-green' : 'bg-[#1a1413] border-red-500 text-red-500'}`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span className="text-sm font-bold">{toast.text}</span>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface/50 rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{confirmModal.title}</h3>
            <p className="text-sm text-text-secondary mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="flex-1 py-2 rounded-md border border-surface text-text-secondary hover:text-white hover:bg-background transition-colors font-medium text-sm">
                Cancelar
              </button>
              <button onClick={confirmModal.onConfirm} className="flex-1 py-2 rounded-md bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors shadow-lg">
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-xl shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <PlaySquare className="text-cs-green" size={24} />
            Estúdio de Criação (Academy)
          </h3>
          <p className="text-xs text-text-secondary mt-1">Gerencie seus cursos, capas e episódios.</p>
        </div>
        <button onClick={() => { resetCourseForm(); setView("course_form"); }} className="flex items-center gap-2 rounded-md bg-cs-green py-2.5 px-6 text-sm font-bold text-white shadow-lg hover:bg-opacity-90 transition-all">
          <Plus size={18} /> Novo Curso
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-cs-green" size={40} /></div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-surface/50 rounded-xl shadow-sm">
          <PlaySquare size={64} className="mx-auto text-surface/50 mb-4" />
          <h4 className="text-xl font-bold text-white mb-2">Seu catálogo está vazio</h4>
          <p className="text-text-secondary">Crie o primeiro curso para começar a capacitar sua equipe e clientes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {courses.map((course) => (
            <div key={course.id} className="group relative flex flex-col">
              <div className="w-full aspect-[2/3] bg-surface rounded-xl overflow-hidden relative shadow-lg mb-3 border border-surface/50 group-hover:border-cs-green/50 transition-colors">
                {course.thumbnail_url ? (
                  <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-surface/50"><ImageIcon size={40} /></div>
                )}
                
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                  <button onClick={() => openLessonsManager(course)} className="bg-cs-green text-white px-4 py-2.5 rounded-md text-xs font-bold w-36 flex items-center justify-center gap-2 hover:bg-opacity-80 transition-colors shadow-lg">
                    <ListVideo size={16} /> Episódios
                  </button>
                  <button onClick={() => openCourseEdit(course)} className="bg-surface border border-surface/50 text-white px-4 py-2.5 rounded-md text-xs font-bold w-36 flex items-center justify-center gap-2 hover:bg-background transition-colors">
                    <Edit size={16} /> Editar Capa
                  </button>
                  <button onClick={() => confirmDeleteCourse(course.id)} className="bg-red-500/90 text-white px-4 py-2.5 rounded-md text-xs font-bold w-36 flex items-center justify-center gap-2 hover:bg-red-600 transition-colors mt-2 shadow-lg">
                    <Trash2 size={16} /> Excluir
                  </button>
                </div>

                <div className="absolute top-3 right-3">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md ${course.status === 'published' ? 'bg-cs-green text-white' : 'bg-surface border border-surface/50 text-text-secondary'}`}>
                    {course.status === 'published' ? 'Publicado' : 'Rascunho'}
                  </span>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-bold text-white leading-tight line-clamp-2 group-hover:text-cs-green transition-colors">{course.title}</h4>
                <p className="text-[10px] text-text-secondary mt-1.5 uppercase tracking-wider font-medium">
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