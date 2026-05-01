"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useSettings } from "@/app/providers/SettingsProvider";

// Importação otimizada para evitar quebra de trace no build da Vercel
import * as Icons from "lucide-react";

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
  { id: 'blog', label: 'Blog Site', icon: Icons.Globe, color: 'text-blue-400' },
  { id: 'instagram', label: 'Instagram', icon: Icons.Camera, color: 'text-pink-500' },
  { id: 'linkedin', label: 'LinkedIn', icon: Icons.Linkedin, color: 'text-blue-600' },
  { id: 'facebook', label: 'Facebook', icon: Icons.Facebook, color: 'text-blue-500' },
  { id: 'tiktok', label: 'TikTok', icon: Icons.Video, color: 'text-zinc-200' },
];

export default function MarketingPage() {
  const router = useRouter();
  const { systemPreferences, companyProfile } = useSettings();
  const labels = systemPreferences?.custom_labels || {};

  // Labels Dinâmicas ARXUM
  const marketingLabel = labels.menu_marketing || "Marketing";
  const postSingular = labels.entity_post_singular || "Postagem";

  // Estados de Controle de Build/SSR
  const [isMounted, setIsMounted] = useState(false);
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

  // Trava de Hidratação para Build Seguro
  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  useEffect(() => { 
    if (isMounted) fetchPosts(); 
  }, [isMounted, fetchPosts]);

  // --- ARXUM MIND: STREAMING ENGINE ---
  const handleArxumMind = async (mode: "brainstorm" | "content") => {
    const contextTitle = mode === "brainstorm" ? aiObjective : title;
    if (!contextTitle.trim()) {
      showToast("A ARXUM Mind precisa de um objetivo ou titulo.", "warning");
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

      if (!response.ok) throw new Error("Falha na comunicacao com ARXUM Mind.");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; 
        
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
      showToast("Processamento ARXUM Mind concluido.", "success");
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast("Carregando midia...", "info");
    try {
      const filePath = `marketing/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('axon-assets').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('axon-assets').getPublicUrl(filePath);
      setImageUrl(data.publicUrl);
      showToast("Midia pronta.", "success");
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

  if (!isMounted) return null;

  return (
    <div className="space-y-6 relative pb-12">
      {/* TOASTS ARXUM MIND */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border bg-[#1a1413] border-white/10 animate-in fade-in slide-in-from-bottom-4">
          <div className={`${toast.type === 'success' ? 'text-cs-green' : 'text-red-500'}`}>
            {toast.type === 'success' ? <Icons.Check size={20} /> : <Icons.AlertCircle size={20} />}
          </div>
          <span className="text-sm font-black uppercase tracking-widest text-white">{toast.message}</span>
        </div>
      )}

      {/* HEADER DINÂMICO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-surface p-6 border border-surface/50 rounded-lg shadow-lg gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-3 uppercase tracking-tighter">
            <Icons.Megaphone className="text-cs-green" size={24} /> {marketingLabel}
          </h3>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5 bg-background px-2 py-1 rounded border border-white/5">
              <Icons.Sparkles size={12} className="text-cs-gold" />
              <span className="text-[9px] font-black text-text-secondary uppercase tracking-widest">1. Estrategia</span>
            </div>
            <Icons.ArrowRight size={10} className="text-white/10" />
            <div className="flex items-center gap-1.5 bg-background px-2 py-1 rounded border border-white/5">
              <Icons.Zap size={12} className="text-cs-green" />
              <span className="text-[9px] font-black text-text-secondary uppercase tracking-widest">2. ARXUM Mind</span>
            </div>
            <Icons.ArrowRight size={10} className="text-white/10" />
            <div className="flex items-center gap-1.5 bg-background px-2 py-1 rounded border border-white/5">
              <Icons.Calendar size={12} className="text-blue-400" />
              <span className="text-[9px] font-black text-text-secondary uppercase tracking-widest">3. Planner</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={() => setView("strategy")} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-cs-gold/10 text-cs-gold border border-cs-gold/20 px-4 py-2.5 rounded-md font-black text-[10px] uppercase tracking-widest hover:bg-cs-gold/20 transition-all">
            <Icons.Sparkles size={16} /> ARXUM Mind Strategy
          </button>
          <button onClick={() => { setEditId(null); setTitle(""); setContent(""); setImageUrl(""); setView("create"); }} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-cs-green text-white px-6 py-2.5 rounded-md font-black text-[10px] uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg">
            <Icons.Plus size={16} /> Novo Agendamento
          </button>
        </div>
      </div>

      {/* VISÃO PLANNER (CALENDÁRIO) */}
      {view === "planner" && (
        <div className="bg-surface border border-surface/50 p-6 rounded-lg shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-background rounded-md text-white/50 hover:text-white transition-all"><Icons.ChevronLeft size={20} /></button>
              <h4 className="text-lg font-black text-white uppercase tracking-tighter">Maio de 2026</h4>
              <button className="p-2 hover:bg-background rounded-md text-white/50 hover:text-white transition-all"><Icons.ChevronRight size={20} /></button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-2 md:gap-4">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(d => (
              <div key={d} className="text-center text-[10px] font-black uppercase text-text-secondary pb-2">{d}</div>
            ))}
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
              const dayPosts = posts.filter(p => new Date(p.scheduled_for).getDate() === day);
              return (
                <div key={day} className="min-h-[100px] md:min-h-[140px] bg-[#1a1413] border border-white/5 rounded-lg p-2 hover:border-cs-green/30 transition-all group relative">
                  <span className="text-xs font-black text-white/10 group-hover:text-cs-green transition-colors">{day}</span>
                  <div className="mt-2 space-y-1">
                    {dayPosts.map(post => (
                      <div 
                        key={post.id} 
                        onClick={() => { 
                          setEditId(post.id); 
                          setTitle(post.title); 
                          setContent(post.content); 
                          setImageUrl(post.image_url || ""); 
                          setScheduledFor(post.scheduled_for.slice(0, 16)); 
                          setSelectedPlatforms(post.platforms || ['blog']); 
                          setStatus(post.status); 
                          setView("create"); 
                        }}
                        className={`text-[8px] md:text-[9px] font-bold p-1.5 border-l-2 rounded truncate cursor-pointer transition-all hover:brightness-125 uppercase ${
                          post.status === 'published' ? 'bg-cs-green/10 border-cs-green text-cs-green' : 
                          post.status === 'draft' ? 'bg-zinc-500/10 border-zinc-500 text-zinc-400' : 
                          'bg-cs-gold/10 border-cs-gold text-cs-gold'
                        }`}
                      >
                        {post.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VISÃO ESTRATÉGIA (BRAINSTORMING) */}
      {view === "strategy" && (
        <div className="max-w-4xl mx-auto space-y-8">
          <button onClick={() => setView("planner")} className="flex items-center gap-2 text-text-secondary hover:text-white transition-all uppercase text-[10px] font-black tracking-widest">
            <Icons.ArrowLeft size={16} /> Voltar ao Planner
          </button>
          
          <div className="bg-surface border border-surface/50 p-8 rounded-lg shadow-2xl space-y-8">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-cs-gold/10 rounded-full flex items-center justify-center mx-auto border border-cs-gold/20">
                <Icons.Sparkles className="text-cs-gold" size={32} />
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">ARXUM Mind Strategy</h2>
              <p className="text-sm text-text-secondary font-medium">Defina seu objetivo e deixe a IA planejar seu cronograma.</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Objetivo de Marketing</label>
                <textarea 
                  value={aiObjective}
                  onChange={(e) => setAiObjective(e.target.value)}
                  className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none resize-none"
                  placeholder="Ex: Aumentar visibilidade da nova linha de produtos..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {AVAILABLE_PLATFORMS.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => setSelectedPlatforms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
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
                {isGenerating ? <Icons.Loader2 className="animate-spin" size={20} /> : <Icons.Zap size={20} />}
                Gerar Planejamento Estrategico
              </button>
            </div>

            {aiStreamResult && (
              <div className="bg-background border border-surface/50 p-6 rounded-lg space-y-4 animate-in fade-in duration-500">
                <h4 className="text-xs font-black text-cs-green uppercase tracking-widest flex items-center gap-2">
                  <Icons.CheckCircle size={14} /> Sugestoes da ARXUM Mind
                </h4>
                <div className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap font-medium">
                  {aiStreamResult}
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
              <Icons.ArrowLeft size={16} /> Voltar ao Planner
            </button>
            
            <div className="bg-surface border border-surface/50 p-8 rounded-lg shadow-2xl space-y-8">
              <div className="flex justify-between items-center border-b border-surface/50 pb-4">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                  <Icons.Edit className="text-cs-green" size={24} /> {editId ? "Editar Post" : "Novo Agendamento"}
                </h3>
                <button 
                  onClick={() => handleArxumMind("content")}
                  disabled={isGenerating}
                  className="flex items-center gap-2 bg-cs-green/10 text-cs-green border border-cs-green/20 px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-cs-green/20 transition-all disabled:opacity-50"
                >
                  {isGenerating ? <Icons.Loader2 className="animate-spin" size={14} /> : <Icons.Sparkles size={14} />}
                  Redigir com ARXUM Mind
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Titulo da Publicacao *</label>
                  <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Conteudo Estrategico *</label>
                  <textarea required rows={10} value={content} onChange={(e) => setContent(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none resize-none custom-scrollbar" />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Data do Lancamento *</label>
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
                    <button type="button" onClick={() => { supabase.from("marketing_posts").delete().eq("id", editId).then(() => { showToast("Excluido.", "success"); setView("planner"); fetchPosts(); }); }} className="flex items-center gap-2 text-red-400 hover:text-red-300 text-[10px] font-black uppercase tracking-widest px-6 transition-all">
                      <Icons.Trash2 size={16} /> Excluir
                    </button>
                  )}
                  <button type="submit" disabled={isSubmitting} className="flex items-center gap-3 bg-cs-green text-white px-10 py-3.5 rounded-md font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-opacity-90 disabled:opacity-50 transition-all">
                    {isSubmitting ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.Save size={18} />}
                    Salvar no Cronograma
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* PREVIEW LATERAL */}
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest px-2">Simulacao de Visualizacao</h4>
            <div className="bg-background border border-surface/50 rounded-3xl overflow-hidden shadow-2xl sticky top-8">
              <div className="p-4 flex items-center gap-3 border-b border-surface/50">
                <div className="w-10 h-10 rounded-full bg-cs-green/10 border border-cs-green/20 flex items-center justify-center text-xs font-black text-cs-green">AR</div>
                <p className="text-xs font-black text-white uppercase tracking-tight">{companyProfile?.company_name || "ARXUM"}</p>
              </div>
              <div className="w-full aspect-square bg-surface flex items-center justify-center overflow-hidden border-b border-surface/50">
                {imageUrl ? <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-3 text-white/10"><Icons.Camera size={48} /><span className="text-[10px] font-black uppercase">Sem Midia</span></div>}
              </div>
              <div className="p-5 space-y-4">
                <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-surface border border-surface/50 rounded text-[10px] font-black uppercase text-white hover:bg-background transition-all flex items-center justify-center gap-2">
                  <Icons.Upload size={14} /> {imageUrl ? "Trocar Midia" : "Upload de Midia"}
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                <p className="text-xs text-white/90 leading-relaxed line-clamp-6 italic">
                  {content || "O conteudo gerado pela ARXUM Mind aparecera aqui..."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}