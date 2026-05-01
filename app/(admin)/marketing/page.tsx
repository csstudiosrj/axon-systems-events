"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Megaphone, Plus, Loader2, ArrowLeft, Calendar, 
  Image as ImageIcon, Camera, Globe, CheckCircle, 
  Clock, Save, Trash2, Edit, X, Upload, 
  AlertTriangle, Eye, Zap, FileText, Check, AlertCircle,
  Sparkles
} from "lucide-react";
import { useSettings } from "@/app/providers/SettingsProvider";

// --- TIPAGENS (BLINDAGEM TYPESCRIPT) ---
interface MarketingPost {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  scheduled_for: string;
  platform_instagram: boolean;
  platform_blog: boolean;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  slug: string | null;
  created_at: string;
}

interface Toast {
  message: string;
  type: "success" | "error" | "warning" | "info";
}

export default function MarketingPage() {
  const router = useRouter();
  const { systemPreferences, companyProfile } = useSettings();
  const labels = systemPreferences?.custom_labels || {};

  // Labels Dinâmicas ARXUM
  const marketingLabel = labels.menu_marketing || "Marketing";
  const postSingular = labels.entity_post_singular || "Postagem";
  const postPlural = labels.entity_post_plural || "Postagens";

  const [view, setView] = useState<"list" | "create">("list");
  const [posts, setPosts] = useState<MarketingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Estados do Formulário
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [platformInstagram, setPlatformInstagram] = useState(false);
  const [platformBlog, setPlatformBlog] = useState(true);
  const [status, setStatus] = useState<MarketingPost['status']>("scheduled");
  
  // UI States
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    if (view === "list") fetchPosts();
  }, [view]);

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("marketing_posts")
      .select("*")
      .order("scheduled_for", { ascending: false });
      
    if (!error && data) setPosts(data as MarketingPost[]);
    setLoading(false);
  };

  // --- IA COPILOTO ARXUM (GOOGLE GEMINI INTEGRATION) ---
  const handleGenerateAI = async () => {
    if (!title) {
      showToast("Insira um título para que a IA tenha contexto.", "warning");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          niche: labels.entity_client_singular || "Cliente",
          companyName: companyProfile?.company_name || "ARXUM"
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Erro na IA");

      setContent(data.content);
      showToast("Conteúdo gerado pelo Gemini com sucesso!", "success");
    } catch (error: any) {
      showToast(`Falha na IA: ${error.message}`, "error");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // --- LÓGICA DE UPLOAD DE IMAGEM ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `marketing/posts/${Date.now()}-${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('axon-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('axon-assets').getPublicUrl(filePath);
      setImageUrl(data.publicUrl);
      showToast("Mídia carregada com sucesso.", "success");
    } catch (error: any) {
      showToast(`Erro no upload: ${error.message}`, "error");
    } finally {
      setUploading(false);
    }
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w ]+/g, "")
      .replace(/ +/g, "-");
  };

  const resetForm = () => {
    setEditId(null);
    setTitle("");
    setContent("");
    setImageUrl("");
    setScheduledFor("");
    setPlatformInstagram(false);
    setPlatformBlog(true);
    setStatus("scheduled");
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content || !scheduledFor) {
      showToast("Campos obrigatórios ausentes.", "warning");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      title,
      content,
      image_url: imageUrl || null,
      scheduled_for: new Date(scheduledFor).toISOString(),
      platform_instagram: platformInstagram,
      platform_blog: platformBlog,
      status,
      slug: generateSlug(title)
    };

    try {
      const { error } = editId 
        ? await supabase.from("marketing_posts").update(payload).eq("id", editId)
        : await supabase.from("marketing_posts").insert([payload]);

      if (error) throw error;

      showToast(`${postSingular} sincronizada com sucesso.`, "success");
      resetForm();
      setView("list");
    } catch (error: any) {
      showToast(`Erro ao salvar: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (post: MarketingPost) => {
    setEditId(post.id);
    setTitle(post.title);
    setContent(post.content);
    setImageUrl(post.image_url || "");
    
    const dateObj = new Date(post.scheduled_for);
    const formattedDate = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setScheduledFor(formattedDate);
    
    setPlatformInstagram(post.platform_instagram);
    setPlatformBlog(post.platform_blog);
    setStatus(post.status);
    setView("create");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("marketing_posts").delete().eq("id", id);
    if (!error) {
      showToast(`${postSingular} excluída.`, "success");
      setConfirmDelete(null);
      fetchPosts();
    } else {
      showToast("Erro ao excluir registro.", "error");
    }
  };

  if (view === "create") {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <div className="flex items-center justify-between">
          <button onClick={() => { resetForm(); setView("list"); }} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors uppercase text-[10px] font-black tracking-widest">
            <ArrowLeft size={16} /> Voltar para o Cronograma
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* FORMULÁRIO */}
          <div className="flex-1 bg-[#1a1413] border border-surface/50 p-8 rounded-lg shadow-2xl space-y-8">
            <div className="border-b border-surface/50 pb-4 flex justify-between items-center">
              <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                <Megaphone className="text-cs-green" size={24} />
                {editId ? `Editar ${postSingular}` : `Agendar Nova ${postSingular}`}
              </h3>
              <button 
                type="button"
                onClick={handleGenerateAI}
                disabled={isGeneratingAI}
                className="flex items-center gap-2 bg-cs-gold/10 text-cs-gold border border-cs-gold/20 px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-cs-gold/20 transition-all disabled:opacity-50"
              >
                {isGeneratingAI ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                Gerar com IA
              </button>
            </div>
            
            <form onSubmit={handleSavePost} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">Título da Publicação (SEO Blog) *</label>
                  <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none" placeholder="Ex: Tendências de Tecnologia para 2026" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">Conteúdo / Corpo do Post *</label>
                  <textarea required rows={8} value={content} onChange={(e) => setContent(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none resize-none custom-scrollbar" placeholder="Escreva o texto completo aqui..." />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">Mídia da Postagem</label>
                  <div className="flex items-center gap-4">
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 bg-surface border border-surface/50 px-4 py-3 rounded-md text-xs font-black uppercase text-white hover:bg-background transition-all"
                    >
                      {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                      {imageUrl ? "Trocar Imagem" : "Upload de Mídia"}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                    {imageUrl && (
                      <span className="text-[10px] text-cs-green font-bold uppercase flex items-center gap-1">
                        <CheckCircle size={12} /> Arquivo Pronto
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">Data e Hora do Lançamento *</label>
                    <input type="datetime-local" required value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">Status do Workflow</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none cursor-pointer">
                      <option value="draft">Rascunho (Privado)</option>
                      <option value="scheduled">Agendado (Automático)</option>
                      <option value="published">Publicado (Ao Vivo)</option>
                      <option value="archived">Arquivado</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-surface/50">
                  <p className="text-[10px] font-black text-text-secondary uppercase mb-4 tracking-widest">Canais de Distribuição</p>
                  <div className="flex gap-8">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={platformInstagram} onChange={(e) => setPlatformInstagram(e.target.checked)} className="rounded border-surface bg-background text-cs-green focus:ring-cs-green w-5 h-5 transition-all" />
                      <span className="text-sm font-bold text-text-secondary group-hover:text-white flex items-center gap-2"><Camera size={18} className="text-pink-500" /> Instagram</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={platformBlog} onChange={(e) => setPlatformBlog(e.target.checked)} className="rounded border-surface bg-background text-cs-green focus:ring-cs-green w-5 h-5 transition-all" />
                      <span className="text-sm font-bold text-text-secondary group-hover:text-white flex items-center gap-2"><Globe size={18} className="text-blue-400" /> Blog ARXUM</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-8">
                <button type="submit" disabled={isSubmitting || uploading} className="flex items-center gap-3 bg-cs-green text-white px-12 py-4 rounded-md font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-opacity-90 transition-all disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {editId ? "Confirmar Alterações" : `Agendar ${postSingular}`}
                </button>
              </div>
            </form>
          </div>

          {/* PREVIEW MOBILE STYLE */}
          <div className="w-full lg:w-80 shrink-0">
            <h4 className="text-[10px] font-black text-text-secondary mb-4 uppercase tracking-[0.2em]">Simulação de Visualização</h4>
            <div className="bg-background border border-surface/50 rounded-3xl overflow-hidden shadow-2xl sticky top-8">
              <div className="p-4 flex items-center gap-3 border-b border-surface/50">
                <div className="w-10 h-10 rounded-full bg-cs-green/10 border border-cs-green/20 flex items-center justify-center text-xs font-black text-cs-green">
                  {companyProfile?.company_name?.substring(0, 2).toUpperCase() || "AR"}
                </div>
                <div>
                  <p className="text-xs font-black text-white uppercase tracking-tight">{companyProfile?.company_name || "ARXUM"}</p>
                  <p className="text-[9px] text-text-secondary font-bold uppercase">
                    {scheduledFor ? new Date(scheduledFor).toLocaleDateString('pt-BR') : 'Aguardando Data'}
                  </p>
                </div>
              </div>
              
              <div className="w-full aspect-square bg-surface flex items-center justify-center overflow-hidden border-b border-surface/50">
                {imageUrl ? (
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover animate-in fade-in duration-500" />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-white/10">
                    <Camera size={48} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Sem Mídia</span>
                  </div>
                )}
              </div>
              
              <div className="p-5 space-y-3">
                <div className="flex gap-3 text-white/80">
                  <Zap size={18} />
                  <Megaphone size={18} />
                  <Globe size={18} />
                </div>
                <p className="text-xs text-white/90 leading-relaxed line-clamp-6">
                  <span className="font-black mr-2 uppercase tracking-tighter text-cs-green">{companyProfile?.company_name?.toLowerCase().replace(/ /g, '') || "arxum"}</span>
                  {content || "O texto da sua publicação aparecerá aqui nesta área de simulação..."}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative pb-12">
      
      {/* TOASTS ARXUM (Fundo Sólido) */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border animate-in fade-in slide-in-from-bottom-4 bg-[#1a1413] border-white/10 ${
          toast.type === 'success' ? 'text-cs-green' : 'text-red-500'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-black uppercase tracking-widest text-white">{toast.message}</span>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO EXCLUSÃO */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1413] border border-surface/50 p-8 rounded-xl shadow-2xl max-w-sm w-full text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20 text-red-500">
              <AlertTriangle size={40} />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Excluir {postSingular}?</h3>
            <p className="text-sm text-text-secondary mb-8 font-medium">Esta ação removerá a postagem do cronograma ARXUM permanentemente.</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 border border-surface rounded-md text-xs font-black uppercase text-text-secondary hover:text-white transition-all">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-3 bg-red-600 text-white rounded-md text-xs font-black uppercase shadow-lg hover:bg-red-500 transition-all">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg shadow-lg">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <Megaphone className="text-cs-green" size={24} />
            {marketingLabel}
          </h3>
          <p className="text-[10px] text-text-secondary mt-1 uppercase tracking-[0.2em] font-black">Automação de Conteúdo ARXUM Cloud</p>
        </div>
        <button
          onClick={() => { resetForm(); setView("create"); }}
          className="flex items-center gap-2 bg-cs-green text-white px-6 py-2.5 rounded-md font-black text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg"
        >
          <Plus size={18} /> Agendar {postSingular}
        </button>
      </div>

      {/* TABELA DE AGENDAMENTOS */}
      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-[10px] uppercase tracking-[0.2em] text-text-secondary font-black">
              <tr>
                <th className="px-8 py-5">Conteúdo / Mídia</th>
                <th className="px-8 py-5">Cronograma</th>
                <th className="px-8 py-5">Canais</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Gestão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <Loader2 className="animate-spin mx-auto mb-4 text-cs-green" size={40} />
                    <span className="text-xs font-black uppercase tracking-[0.3em] text-cs-green animate-pulse">Acessando ARXUM Cloud...</span>
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center text-text-secondary italic font-bold uppercase tracking-widest">
                    Nenhuma postagem agendada no momento.
                  </td>
                </tr>
              ) : (
                posts.map((post) => (
                  <tr key={post.id} className="hover:bg-background/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-background border border-surface/50 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                          {post.image_url ? <img src={post.image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-white/10" />}
                        </div>
                        <div>
                          <p className="font-black text-white uppercase tracking-tight group-hover:text-cs-green transition-colors">{post.title}</p>
                          <p className="text-[10px] mt-0.5 font-bold text-text-secondary uppercase tracking-tighter">Slug: {post.slug || 'n/a'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-white font-bold">
                          <Calendar size={14} className="text-cs-gold" />
                          {new Date(post.scheduled_for).toLocaleDateString('pt-BR')}
                        </div>
                        <span className="text-[10px] font-black text-text-secondary uppercase">às {new Date(post.scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex gap-3">
                        {post.platform_instagram && (
                          <span title="Instagram (Agendado)">
                            <Camera size={18} className="text-pink-500 opacity-50" />
                          </span>
                        )}
                        {post.platform_blog && (
                          <span title="Blog ARXUM">
                            <Globe size={18} className="text-blue-400" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase border tracking-widest ${
                        post.status === 'published' ? 'bg-cs-green/10 text-cs-green border-cs-green/20' :
                        post.status === 'draft' ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' :
                        'bg-cs-gold/10 text-cs-gold border-cs-gold/20'
                      }`}>
                        {post.status === 'published' ? <CheckCircle size={12} /> : <Clock size={12} />}
                        {post.status === 'published' ? 'Publicado' : post.status === 'draft' ? 'Rascunho' : 'Agendado'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(post)} className="p-2 bg-surface border border-surface/50 text-text-secondary hover:text-cs-gold hover:border-cs-gold rounded-md transition-all shadow-sm">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => setConfirmDelete(post.id)} className="p-2 bg-surface border border-surface/50 text-text-secondary hover:text-red-500 hover:border-red-500 rounded-md transition-all shadow-sm">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}