"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Camera,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Edit,
  Globe,
  Hash,
  Link,
  Loader2,
  Megaphone,
  Music,
  Plus,
  Save,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Zap,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface MarketingPost {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  scheduled_for: string;
  platforms: string[];
  status: "draft" | "scheduled" | "published" | "archived";
  slug: string | null;
}

interface Toast {
  message: string;
  type: "success" | "error" | "warning";
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const AVAILABLE_PLATFORMS = [
  { id: "blog",      label: "Blog Site",  Icon: Globe,   color: "text-blue-400"  },
  { id: "instagram", label: "Instagram",  Icon: Camera,  color: "text-pink-500"  },
  { id: "linkedin",  label: "LinkedIn",   Icon: Link,    color: "text-blue-400"  },
  { id: "facebook",  label: "Facebook",   Icon: Share2,  color: "text-blue-500"  },
  { id: "tiktok",    label: "TikTok",     Icon: Music,   color: "text-zinc-200"  },
];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MarketingPage() {
  const { systemPreferences, companyProfile } = useSettings();
  const labels = systemPreferences?.custom_labels ?? {};

  const marketingLabel = labels.menu_marketing ?? "Marketing";

  const [isMounted, setIsMounted]               = useState(false);
  const [view, setView]                         = useState<"planner" | "create" | "strategy">("planner");
  const [posts, setPosts]                       = useState<MarketingPost[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [isSubmitting, setIsSubmitting]         = useState(false);
  const [isGenerating, setIsGenerating]         = useState(false);
  const [aiObjective, setAiObjective]           = useState("");
  const [aiStreamResult, setAiStreamResult]     = useState("");
  const [editId, setEditId]                     = useState<string | null>(null);
  const [title, setTitle]                       = useState("");
  const [content, setContent]                   = useState("");
  const [imageUrl, setImageUrl]                 = useState("");
  const [scheduledFor, setScheduledFor]         = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["blog"]);
  const [status, setStatus]                     = useState<MarketingPost["status"]>("scheduled");
  const [toast, setToast]                       = useState<Toast | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setIsMounted(true); }, []);

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("marketing_posts")
      .select("*")
      .order("scheduled_for", { ascending: true });
    if (!error && data) setPosts(data as MarketingPost[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isMounted) void fetchPosts();
  }, [isMounted, fetchPosts]);

  // ─── ARXUM Mind: streaming ────────────────────────────────────────────────

  async function handleArxumMind(mode: "brainstorm" | "content") {
    const contextTitle = mode === "brainstorm" ? aiObjective : title;
    if (!contextTitle.trim()) {
      showToast("A ARXUM Mind precisa de um objetivo ou título.", "warning");
      return;
    }

    setIsGenerating(true);
    setAiStreamResult("");
    if (mode === "content") setContent("");

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          title: contextTitle,
          objective: aiObjective,
          niche: labels.entity_client_singular ?? "Cliente",
          companyName: companyProfile?.company_name ?? "ARXUM",
          platforms: selectedPlatforms,
        }),
      });

      if (!response.ok) throw new Error("Falha na comunicação com ARXUM Mind.");
      if (!response.body) throw new Error("Sem corpo na resposta.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.substring(6)) as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            };
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            if (mode === "brainstorm") setAiStreamResult((prev) => prev + text);
            else setContent((prev) => prev + text);
          } catch {
            // chunk inválido — ignora
          }
        }
      }

      showToast("Processamento ARXUM Mind concluído.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro inesperado.", "error");
    } finally {
      setIsGenerating(false);
    }
  }

  // ─── Upload de imagem ─────────────────────────────────────────────────────

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast("Carregando mídia…", "warning");
    try {
      const filePath = `marketing/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("axon-assets")
        .upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("axon-assets").getPublicUrl(filePath);
      setImageUrl(data.publicUrl);
      showToast("Mídia pronta.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro no upload.", "error");
    }
  }

  // ─── Salvar post ──────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !scheduledFor) return;
    setIsSubmitting(true);

    const payload = {
      title,
      content,
      image_url: imageUrl || null,
      scheduled_for: new Date(scheduledFor).toISOString(),
      platforms: selectedPlatforms,
      status,
      slug: title.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, ""),
    };

    const { error } = editId
      ? await supabase.from("marketing_posts").update(payload).eq("id", editId)
      : await supabase.from("marketing_posts").insert([payload]);

    if (!error) {
      showToast("Cronograma atualizado.", "success");
      setView("planner");
      void fetchPosts();
    } else {
      showToast(error.message, "error");
    }
    setIsSubmitting(false);
  }

  function openEdit(post: MarketingPost) {
    setEditId(post.id);
    setTitle(post.title);
    setContent(post.content);
    setImageUrl(post.image_url ?? "");
    setScheduledFor(post.scheduled_for.slice(0, 16));
    setSelectedPlatforms(post.platforms ?? ["blog"]);
    setStatus(post.status);
    setView("create");
  }

  function resetForm() {
    setEditId(null);
    setTitle("");
    setContent("");
    setImageUrl("");
    setScheduledFor("");
    setSelectedPlatforms(["blog"]);
    setStatus("scheduled");
  }

  if (!isMounted) return null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative space-y-6 pb-12">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 rounded-lg border border-white/10 bg-[var(--color-surface)] px-6 py-4 shadow-2xl">
          {toast.type === "success"
            ? <Check size={20} className="text-[var(--color-cs-green)]" />
            : <AlertCircle size={20} className="text-red-400" />}
          <span className="text-sm font-black uppercase tracking-widest text-white">
            {toast.message}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-[var(--color-surface)] p-6 shadow-lg md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="flex items-center gap-3 text-xl font-bold uppercase tracking-tighter text-white">
            <Megaphone className="text-[var(--color-cs-green)]" size={24} />
            {marketingLabel}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {[
              { Icon: Sparkles, label: "1. Estratégia",  color: "text-[var(--color-cs-gold)]"  },
              { Icon: Zap,      label: "2. ARXUM Mind",  color: "text-[var(--color-cs-green)]" },
              { Icon: Calendar, label: "3. Planner",     color: "text-blue-400"                 },
            ].map(({ Icon, label, color }, i, arr) => (
              <React.Fragment key={label}>
                <div className="flex items-center gap-1.5 rounded border border-white/5 bg-black/20 px-2 py-1">
                  <Icon size={12} className={color} />
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-secondary)]">{label}</span>
                </div>
                {i < arr.length - 1 && <ArrowRight size={10} className="text-white/10" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex w-full gap-3 md:w-auto">
          <button
            onClick={() => setView("strategy")}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-[var(--color-cs-gold)]/20 bg-[var(--color-cs-gold)]/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--color-cs-gold)] transition hover:bg-[var(--color-cs-gold)]/20 md:flex-none"
          >
            <Sparkles size={16} /> ARXUM Mind Strategy
          </button>
          <button
            onClick={() => { resetForm(); setView("create"); }}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[var(--color-cs-green)] px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition hover:opacity-90 md:flex-none"
          >
            <Plus size={16} /> Novo agendamento
          </button>
        </div>
      </div>

      {/* ── Planner ────────────────────────────────────────────────────────── */}
      {view === "planner" && (
        <div className="rounded-lg border border-white/10 bg-[var(--color-surface)] p-6 shadow-2xl">
          <div className="mb-8 flex items-center gap-4">
            <button className="rounded-md p-2 text-white/50 transition hover:bg-black/20 hover:text-white">
              <ChevronLeft size={20} />
            </button>
            <h4 className="text-lg font-black uppercase tracking-tighter text-white">
              Maio de 2026
            </h4>
            <button className="rounded-md p-2 text-white/50 transition hover:bg-black/20 hover:text-white">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 md:gap-4">
            {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
              <div key={d} className="pb-2 text-center text-[10px] font-black uppercase text-[var(--color-text-secondary)]">
                {d}
              </div>
            ))}
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
              const dayPosts = posts.filter(
                (p) => new Date(p.scheduled_for).getDate() === day
              );
              return (
                <div
                  key={day}
                  className="group relative min-h-[100px] rounded-lg border border-white/5 bg-black/20 p-2 transition hover:border-[var(--color-cs-green)]/30 md:min-h-[140px]"
                >
                  <span className="text-xs font-black text-white/10 transition group-hover:text-[var(--color-cs-green)]">
                    {day}
                  </span>
                  <div className="mt-2 space-y-1">
                    {dayPosts.map((post) => (
                      <div
                        key={post.id}
                        onClick={() => openEdit(post)}
                        className={`cursor-pointer truncate rounded border-l-2 p-1.5 text-[8px] font-bold uppercase transition hover:brightness-125 md:text-[9px] ${
                          post.status === "published"
                            ? "border-[var(--color-cs-green)] bg-[var(--color-cs-green)]/10 text-[var(--color-cs-green)]"
                            : post.status === "draft"
                            ? "border-zinc-500 bg-zinc-500/10 text-zinc-400"
                            : "border-[var(--color-cs-gold)] bg-[var(--color-cs-gold)]/10 text-[var(--color-cs-gold)]"
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

          {!loading && posts.length === 0 && (
            <p className="mt-8 text-center text-sm text-[var(--color-text-secondary)]">
              Nenhum post agendado ainda.
            </p>
          )}
        </div>
      )}

      {/* ── Strategy ───────────────────────────────────────────────────────── */}
      {view === "strategy" && (
        <div className="mx-auto max-w-4xl space-y-8">
          <button
            onClick={() => setView("planner")}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-secondary)] transition hover:text-white"
          >
            <ArrowLeft size={16} /> Voltar ao planner
          </button>

          <div className="space-y-8 rounded-lg border border-white/10 bg-[var(--color-surface)] p-8 shadow-2xl">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-cs-gold)]/20 bg-[var(--color-cs-gold)]/10">
                <Sparkles className="text-[var(--color-cs-gold)]" size={32} />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-white">
                ARXUM Mind Strategy
              </h2>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                Defina seu objetivo e deixe a IA planejar seu cronograma.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-[var(--color-text-secondary)]">
                  Objetivo de marketing
                </label>
                <textarea
                  value={aiObjective}
                  onChange={(e) => setAiObjective(e.target.value)}
                  rows={3}
                  placeholder="Ex: Aumentar visibilidade da nova linha de produtos…"
                  className="w-full resize-none rounded-md border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-cs-green)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                {AVAILABLE_PLATFORMS.map(({ id, label, Icon, color }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      setSelectedPlatforms((prev) =>
                        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                      )
                    }
                    className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition ${
                      selectedPlatforms.includes(id)
                        ? "border-[var(--color-cs-green)]/50 bg-[var(--color-cs-green)]/10"
                        : "border-white/10 bg-black/20 opacity-50"
                    }`}
                  >
                    <Icon size={20} className={color} />
                    <span className="text-[9px] font-black uppercase text-white">{label}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void handleArxumMind("brainstorm")}
                disabled={isGenerating}
                className="flex w-full items-center justify-center gap-3 rounded-md bg-[var(--color-cs-gold)] py-4 text-xs font-black uppercase tracking-[0.3em] text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
                Gerar planejamento estratégico
              </button>
            </div>

            {aiStreamResult && (
              <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-6">
                <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--color-cs-green)]">
                  <CheckCircle size={14} /> Sugestões da ARXUM Mind
                </h4>
                <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-white/90">
                  {aiStreamResult}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create / Edit ──────────────────────────────────────────────────── */}
      {view === "create" && (
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 pb-12 lg:grid-cols-3">
          {/* Editor */}
          <div className="space-y-6 lg:col-span-2">
            <button
              onClick={() => setView("planner")}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-secondary)] transition hover:text-white"
            >
              <ArrowLeft size={16} /> Voltar ao planner
            </button>

            <div className="space-y-8 rounded-lg border border-white/10 bg-[var(--color-surface)] p-8 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="flex items-center gap-3 text-xl font-black uppercase tracking-tighter text-white">
                  <Edit className="text-[var(--color-cs-green)]" size={24} />
                  {editId ? "Editar post" : "Novo agendamento"}
                </h3>
                <button
                  type="button"
                  onClick={() => void handleArxumMind("content")}
                  disabled={isGenerating}
                  className="flex items-center gap-2 rounded-md border border-[var(--color-cs-green)]/20 bg-[var(--color-cs-green)]/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-cs-green)] transition hover:bg-[var(--color-cs-green)]/20 disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                  Redigir com ARXUM Mind
                </button>
              </div>

              <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-[var(--color-text-secondary)]">
                    Título da publicação *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-cs-green)]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-[var(--color-text-secondary)]">
                    Conteúdo estratégico *
                  </label>
                  <textarea
                    required
                    rows={10}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full resize-none rounded-md border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-cs-green)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-[var(--color-text-secondary)]">
                      Data de lançamento *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      className="w-full rounded-md border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-cs-green)]"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-[var(--color-text-secondary)]">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as MarketingPost["status"])}
                      className="w-full rounded-md border border-white/10 bg-[var(--color-surface)] px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-cs-green)]"
                    >
                      <option value="draft">Rascunho</option>
                      <option value="scheduled">Agendado</option>
                      <option value="published">Publicado</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-4 border-t border-white/10 pt-6">
                  {editId && (
                    <button
                      type="button"
                      onClick={async () => {
                        await supabase.from("marketing_posts").delete().eq("id", editId);
                        showToast("Excluído.", "success");
                        setView("planner");
                        void fetchPosts();
                      }}
                      className="flex items-center gap-2 px-6 text-[10px] font-black uppercase tracking-widest text-red-400 transition hover:text-red-300"
                    >
                      <Trash2 size={16} /> Excluir
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-3 rounded-md bg-[var(--color-cs-green)] px-10 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-2xl transition hover:opacity-90 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Salvar no cronograma
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-6">
            <p className="px-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-secondary)]">
              Simulação de visualização
            </p>
            <div className="sticky top-8 overflow-hidden rounded-3xl border border-white/10 bg-black/20 shadow-2xl">
              <div className="flex items-center gap-3 border-b border-white/10 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-cs-green)]/20 bg-[var(--color-cs-green)]/10 text-xs font-black text-[var(--color-cs-green)]">
                  AR
                </div>
                <p className="text-xs font-black uppercase tracking-tight text-white">
                  {companyProfile?.company_name ?? "ARXUM"}
                </p>
              </div>

              <div className="flex aspect-square w-full items-center justify-center overflow-hidden border-b border-white/10 bg-[var(--color-surface)]">
                {imageUrl
                  ? <img src={imageUrl} alt="Preview" className="h-full w-full object-cover" />
                  : (
                    <div className="flex flex-col items-center gap-3 text-white/10">
                      <Camera size={48} />
                      <span className="text-[10px] font-black uppercase">Sem mídia</span>
                    </div>
                  )}
              </div>

              <div className="space-y-4 p-5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded border border-white/10 bg-black/20 py-2 text-[10px] font-black uppercase text-white transition hover:bg-white/5"
                >
                  <Upload size={14} />
                  {imageUrl ? "Trocar mídia" : "Upload de mídia"}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => void handleFileUpload(e)}
                  className="hidden"
                  accept="image/*"
                />
                <p className="line-clamp-6 text-xs italic leading-relaxed text-white/90">
                  {content || "O conteúdo gerado pela ARXUM Mind aparecerá aqui…"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}