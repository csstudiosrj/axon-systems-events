"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Megaphone, Plus, Loader2, ArrowLeft, Calendar, 
  Image as ImageIcon, Camera, Globe, CheckCircle, 
  Clock, Save, Trash2, Edit, X, Upload, 
  AlertTriangle, Eye, Zap, FileText, Check, AlertCircle,
  Sparkles, Linkedin, Facebook, Video, ChevronLeft, ChevronRight,
  LayoutGrid, List, Info, Send
} from "lucide-react";
import { useSettings } from "@/app/providers/SettingsProvider";

// --- TIPAGENS ---
interface MarketingPost {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  scheduled_for: string;
  platforms: string[];
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  slug: string | null;
}

interface Toast { message: string; type: "success" | "error" | "warning"; }

const AVAILABLE_PLATFORMS = [
  { id: 'blog', label: 'Blog Site', icon: Globe, color: 'text-blue-400' },
  { id: 'instagram', label: 'Instagram', icon: Camera, color: 'text-pink-500' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-600' },
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-500' },
  { id: 'tiktok', label: 'TikTok', icon: Video, color: 'text-zinc-200' },
];

export default function MarketingPage() {
  const router = useRouter();
  const { systemPreferences, companyProfile } = useSettings();
  const labels = systemPreferences?.custom_labels || {};

  // Labels Dinâmicas
  const marketingLabel = labels.menu_marketing || "Marketing";
  const postSingular = labels.entity_post_singular || "Postagem";

  // Estados de Navegação
  const [view, setView] = useState<"planner" | "create" | "strategy">("planner");
  const [posts, setPosts] = useState<MarketingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados ARXUM Mind (IA)
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiObjective, setAiObjective] = useState("");
  const [aiStreamResult, setAiStreamResult] = useState("");

  // Estados do Formulário
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['blog']);
  const [status, setStatus] = useState<MarketingPost['status']>("scheduled");
  
  // UI
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("marketing_posts").select("*").order("scheduled_for", { ascending: true });
    if (!error && data) setPosts(data as MarketingPost[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // --- ARXUM MIND: STREAMING ENGINE ---
  const handleArxumMind = async (mode: "brainstorm" | "content") => {
    const contextTitle = mode === "brainstorm" ? aiObjective : title;
    if (!contextTitle) {
      showToast("Forneça um objetivo ou título para a ARXUM Mind.", "warning");
      return;
    }

    setIsGenerating(true);
    setAiStreamResult("");
    if (mode === "content") setContent("");

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          title: contextTitle,
          objective: aiObjective,
          niche: labels.entity_client_singular || "Cliente",
          companyName: companyProfile?.company_name || "ARXUM",
          platforms: selectedPlatforms
        })
      });

      if (!response.ok) throw new Error("Falha na conexão com ARXUM Mind.");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6));
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (mode === "brainstorm") setAiStreamResult(prev => prev + text);
              else setContent(prev => prev + text);
            } catch (e) {}
          }
        }
      }
      showToast("Processamento finalizado pela ARXUM Mind.", "success");
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast("Carregando mídia...", "info");
    try {
      const filePath = `marketing/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('axon-assets').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('axon-assets').getPublicUrl(filePath);
      setImageUrl(data.publicUrl);
      showToast("Mídia pronta.", "success");
    } catch (error: any) { showToast(error.message, "error"); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !scheduledFor) return;
    setIsSubmitting(true);

    const payload = {
      title, content, image_url: imageUrl || null,
      scheduled_for: new Date(scheduledFor).toISOString(),
      platforms: selectedPlatforms,
      status,
      slug: title.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, "")
    };

    const { error } = editId 
      ? await supabase.from("marketing_posts").update(payload).eq("id", editId)
      : await supabase.from("marketing_posts").insert([payload]);

    if (!error) {
      showToast("Cronograma atualizado.", "success");
      setView("planner");
      fetchPosts();
    } else { showToast(error.message, "error"); }
    setIsSubmitting(false);
  };

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  // --- RENDERIZADORES ---
  const CalendarGrid = () => {
    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    return (
      <div className="grid grid-cols-7 gap-4">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
          <div key={d} className="text-center text-[10px] font-black uppercase text-text-secondary pb-2">{d}</div>
        ))}
        {days.map(day => {
          const dayPosts = posts.filter(p => new Date(p.scheduled_for).getDate() === day);
          return (
            <div key={day} className="min-h-[120px] bg-surface border border-surface/50 rounded-lg p-2 hover:border-cs-green/30 transition-all group relative">
              <span className="text-xs font-black text-white/20 group-hover:text-cs-green transition-colors">{day}</span>
              <div className="mt-2 space-y-1">
                {dayPosts.map(post => (
                  <div 
                    key={post.id} 
                    onClick={() => { setEditId(post.id); setTitle(post.title); setContent(post.content); setImageUrl(post.image_url || ""); setScheduledFor(post.scheduled_for.slice(0, 16)); setSelectedPlatforms(post.platforms); setStatus(post.status); setView("create"); }}
                    className="text-[9px] font-bold p-1.5 bg-background border-l-2 border-cs-green rounded truncate cursor-pointer hover:bg-cs-green/10 text-white uppercase"
                  >
                    {post.title}
                  </div>
                ))}
              </div>
              <button onClick={() => { setScheduledFor(`2026-05-${day.toString().padStart(2, '0')}T09:00`); setView("create"); }} className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-cs-green text-white p-1 rounded-full shadow-lg">
                <Plus size={12} />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 relative pb-12">
      {/* TOASTS ARXUM MIND */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border bg-[#1a1413] border-white/10 animate-in fade-in slide-in-from-bottom-4">
          <div className={`${toast.type === 'success' ? 'text-cs-green' : 'text-red-500'}`}>
            {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          </div>
          <span className="text-sm font-black uppercase tracking-widest text-white">{toast.message}</span>
        </div>
      )}

      {/* HEADER DINÂMICO */}
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg shadow-lg">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-3 uppercase tracking-tighter">
            <Megaphone className="text-cs-green" size={24} /> {marketingLabel}
          </h3>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest flex items-center gap-1">
              <Info size={12} className="text-cs-gold" /> 1. Planeje a Estratégia
            </span>
            <ArrowRight size={12} className="text-white/10" />
            <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest flex items-center gap-1">
              <Info size={12} className="text-cs-gold" /> 2. ARXUM Mind gera o conteúdo
            </span>
            <ArrowRight size={12} className="text-white/10" />
            <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest flex items-center gap-1">
              <Info size={12} className="text-cs-gold" /> 3. Agende no Calendário
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setView("strategy")} className="flex items-center gap-2 bg-cs-gold/10 text-cs-gold border border-cs-gold/20 px-4 py-2 rounded-md font-black text-[10px] uppercase tracking-widest hover:bg-cs-gold/20 transition-all">
            <Sparkles size={16} /> ARXUM Mind Strategy
          </button>
          <button onClick={() => { setEditId(null); setView("create"); }} className="flex items-center gap-2 bg-cs-green text-white px-6 py-2 rounded-md font-black text-[10px] uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg">
            <Plus size={16} /> Novo Agendamento
          </button>
        </div>
      </div>

      {/* VISÃO PLANNER (CALENDÁRIO) */}
      {view === "planner" && (
        <div className="bg-surface border border-surface/50 p-6 rounded-lg shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-background rounded-md text-white/50 hover:text-white transition-all"><ChevronLeft size={20} /></button>
              <h4 className="text-lg font-black text-white uppercase tracking-tighter">Maio de 2026</h4>
              <button className="p-2 hover:bg-background rounded-md text-white/50 hover:text-white transition-all"><ChevronRight size={20} /></button>
            </div>
            <div className="flex bg-background p-1 rounded-md border border-surface/50">
              <button className="px-4 py-1.5 bg-surface text-white text-[10px] font-black uppercase rounded shadow-sm">Mês</button>
              <button className="px-4 py-1.5 text-text-secondary text-[10px] font-black uppercase">Semana</button>
            </div>
          </div>
          {loading ? <div className="py-24 text-center"><Loader2 className="animate-spin mx-auto text-cs-green" size={32} /></div> : <CalendarGrid />}
        </div>
      )}

      {/* VISÃO ESTRATÉGIA (BRAINSTORMING) */}
      {view === "strategy" && (
        <div className="max-w-4xl mx-auto space-y-8">
          <button onClick={() => setView("planner")} className="flex items-center gap-2 text-text-secondary hover:text-white transition-all uppercase text-[10px] font-black tracking-widest">
            <ArrowLeft size={16} /> Voltar ao Planner
          </button>
          
          <div className="bg-surface border border-surface/50 p-8 rounded-lg shadow-2xl space-y-8">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-cs-gold/10 rounded-full flex items-center justify-center mx-auto border border-cs-gold/20">
                <Sparkles className="text-cs-gold" size={32} />
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">ARXUM Mind Strategy</h2>
              <p className="text-sm text-text-secondary font-medium">Defina seu objetivo e deixe a IA planejar seu cronograma de conteúdo.</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Qual o objetivo de marketing deste mês?</label>
                <textarea 
                  value={aiObjective}
                  onChange={(e) => setAiObjective(e.target.value)}
                  className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none resize-none"
                  placeholder="Ex: Aumentar vendas da nova linha de iluminação cênica..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-5 gap-4">
                {AVAILABLE_PLATFORMS.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => togglePlatform(p.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${selectedPlatforms.includes(p.id) ? 'bg-cs-green/10 border-cs-green/50' : 'bg-background border-surface/50 opacity-50'}`}
                  >
                    <p.icon size={20} className={p.color} />
                    <span className="text-[9px] font-black uppercase text-white">{p.label}</span>
                  </button>
                ))}
              </div>

              <button 
                onClick={() => handleArxumMind("brainstorm")}
                disabled={isGenerating}
                className="w-full py-4 bg-cs-gold text-white font-black text-xs uppercase tracking-[0.3em] rounded-md shadow-lg hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
                Gerar Planejamento Estratégico
              </button>
            </div>

            {aiStreamResult && (
              <div className="bg-background border border-surface/50 p-6 rounded-lg space-y-4 animate-in fade-in duration-500">
                <h4 className="text-xs font-black text-cs-green uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle size={14} /> Sugestões da ARXUM Mind
                </h4>
                <div className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap font-medium">
                  {aiStreamResult}
                </div>
                <div className="pt-4 border-t border-surface/50 text-[10px] text-text-secondary italic">
                  Gostou das sugestões? Clique em "Novo Agendamento" para começar a criar os posts baseados nestes temas.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISÃO CRIAÇÃO (EDITOR) */}
      {view === "create" && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
          <div className="lg:col-span-2 space-y-6">
            <button onClick={() => setView("planner")} className="flex items-center gap-2 text-text-secondary hover:text-white transition-all uppercase text-[10px] font-black tracking-widest">
              <ArrowLeft size={16} /> Voltar ao Planner
            </button>
            
            <div className="bg-surface border border-surface/50 p-8 rounded-lg shadow-2xl space-y-8">
              <div className="flex justify-between items-center border-b border-surface/50 pb-4">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                  <Edit className="text-cs-green" size={24} /> {editId ? "Editar Post" : "Novo Agendamento"}
                </h3>
                <button 
                  onClick={() => handleArxumMind("content")}
                  disabled={isGenerating}
                  className="flex items-center gap-2 bg-cs-green/10 text-cs-green border border-cs-green/20 px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-cs-green/20 transition-all disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                  Redigir com ARXUM Mind
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Título da Publicação *</label>
                  <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none" placeholder="Ex: Por que investir em LED de alta resolução?" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Conteúdo Estratégico (Blog e Social) *</label>
                  <textarea required rows={10} value={content} onChange={(e) => setContent(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none resize-none custom-scrollbar" placeholder="A IA redigirá aqui ou você pode escrever manualmente..." />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Data do Lançamento *</label>
                    <input type="datetime-local" required value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none">
                      <option value="draft">Rascunho</option>
                      <option value="scheduled">Agendado</option>
                      <option value="published">Publicado</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-surface/50 flex justify-end gap-4">
                  {editId && (
                    <button type="button" onClick={() => setConfirmDelete(editId)} className="flex items-center gap-2 text-red-400 hover:text-red-300 text-[10px] font-black uppercase tracking-widest px-6 transition-all">
                      <Trash2 size={16} /> Excluir
                    </button>
                  )}
                  <button type="submit" disabled={isSubmitting} className="flex items-center gap-3 bg-cs-green text-white px-10 py-3.5 rounded-md font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-opacity-90 disabled:opacity-50 transition-all">
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Salvar no Cronograma
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* PREVIEW LATERAL */}
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest px-2">Simulação de Visualização</h4>
            <div className="bg-background border border-surface/50 rounded-3xl overflow-hidden shadow-2xl sticky top-8">
              <div className="p-4 flex items-center gap-3 border-b border-surface/50">
                <div className="w-10 h-10 rounded-full bg-cs-green/10 border border-cs-green/20 flex items-center justify-center text-xs font-black text-cs-green">AR</div>
                <p className="text-xs font-black text-white uppercase tracking-tight">{companyProfile?.company_name || "ARXUM"}</p>
              </div>
              <div className="w-full aspect-square bg-surface flex items-center justify-center overflow-hidden border-b border-surface/50">
                {imageUrl ? <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-3 text-white/10"><Camera size={48} /><span className="text-[10px] font-black uppercase">Sem Mídia</span></div>}
              </div>
              <div className="p-5 space-y-4">
                <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-surface border border-surface/50 rounded text-[10px] font-black uppercase text-white hover:bg-background transition-all flex items-center justify-center gap-2">
                  <Upload size={14} /> {imageUrl ? "Trocar Mídia" : "Upload de Mídia"}
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                <p className="text-xs text-white/90 leading-relaxed line-clamp-6 italic">
                  {content || "O conteúdo gerado pela ARXUM Mind aparecerá aqui..."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO EXCLUSÃO */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1413] border border-surface/50 p-8 rounded-xl shadow-2xl max-w-sm w-full text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20 text-red-500">
              <AlertTriangle size={40} />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Excluir Postagem?</h3>
            <p className="text-sm text-text-secondary mb-8 font-medium">Esta ação removerá o agendamento permanentemente.</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 border border-surface rounded-md text-xs font-black uppercase text-text-secondary hover:text-white transition-all">Cancelar</button>
              <button onClick={async () => { await supabase.from("marketing_posts").delete().eq("id", confirmDelete); setConfirmDelete(null); fetchPosts(); showToast("Excluído.", "success"); }} className="flex-1 py-3 bg-red-600 text-white rounded-md text-xs font-black uppercase shadow-lg hover:bg-red-500 transition-all">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}