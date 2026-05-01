"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Camera,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  Globe,
  Info,
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
  Wand2,
  X,
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

interface AiSuggestion {
  title: string;
  date: string;      // "YYYY-MM-DD"
  time: string;      // "HH:MM"
  rationale: string;
  selected: boolean;
}

interface Toast {
  message: string;
  type: "success" | "error" | "warning";
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: "blog",      label: "Blog",      Icon: Globe,   color: "text-blue-400"  },
  { id: "instagram", label: "Instagram", Icon: Camera,  color: "text-pink-500"  },
  { id: "linkedin",  label: "LinkedIn",  Icon: Link,    color: "text-blue-400"  },
  { id: "facebook",  label: "Facebook",  Icon: Share2,  color: "text-blue-500"  },
  { id: "tiktok",    label: "TikTok",    Icon: Music,   color: "text-zinc-200"  },
];

const STATUS_STYLES: Record<MarketingPost["status"], string> = {
  published: "border-[var(--color-cs-green)] bg-[var(--color-cs-green)]/10 text-[var(--color-cs-green)]",
  draft:     "border-zinc-500 bg-zinc-500/10 text-zinc-400",
  scheduled: "border-[var(--color-cs-gold)] bg-[var(--color-cs-gold)]/10 text-[var(--color-cs-gold)]",
  archived:  "border-white/20 bg-white/5 text-white/40",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string) {
  return text.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, "");
}

function toLocalDatetimeValue(isoString: string) {
  // converte ISO para o formato esperado pelo input datetime-local
  return isoString.slice(0, 16);
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MarketingPage() {
  const { systemPreferences, companyProfile } = useSettings();
  const labels = systemPreferences?.custom_labels ?? {};
  const marketingLabel = labels.menu_marketing ?? "Marketing";
  const companyName = companyProfile?.company_name ?? "AXON";

  // Controle de view
  const [view, setView] = useState<"planner" | "pauta" | "editor">("planner");

  // Dados
  const [posts, setPosts]   = useState<MarketingPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Pauta com IA
  const [objective, setObjective]         = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["blog"]);
  const [suggestions, setSuggestions]     = useState<AiSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [addingToPlanner, setAddingToPlanner]       = useState(false);

  // Editor
  const [editId, setEditId]               = useState<string | null>(null);
  const [title, setTitle]                 = useState("");
  const [content, setContent]             = useState("");
  const [imageUrl, setImageUrl]           = useState("");
  const [scheduledFor, setScheduledFor]   = useState("");
  const [editorPlatforms, setEditorPlatforms] = useState<string[]>(["blog"]);
  const [postStatus, setPostStatus]       = useState<MarketingPost["status"]>("scheduled");
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isPublishing, setIsPublishing]   = useState(false);

  // UI
  const [toast, setToast]   = useState<Toast | null>(null);
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef   = useRef<HTMLTextAreaElement>(null);

  // ── Init ──────────────────────────────────────────────────────────────────

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
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

  useEffect(() => { void fetchPosts(); }, [fetchPosts]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // ── Calendário ────────────────────────────────────────────────────────────

  const calLabel = new Date(calMonth.year, calMonth.month, 1)
    .toLocaleString("pt-BR", { month: "long", year: "numeric" });

  function calPrevMonth() {
    setCalMonth((prev) => {
      const d = new Date(prev.year, prev.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function calNextMonth() {
    setCalMonth((prev) => {
      const d = new Date(prev.year, prev.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const firstDayOfWeek = new Date(calMonth.year, calMonth.month, 1).getDay();
  const daysInMonth    = new Date(calMonth.year, calMonth.month + 1, 0).getDate();

  // ── Pauta com IA ──────────────────────────────────────────────────────────

  async function handleGenerateSuggestions() {
    if (!objective.trim()) {
      showToast("Descreva o objetivo antes de gerar sugestões.", "warning");
      return;
    }
    setLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "suggestions",
          objective,
          companyName,
          niche: labels.entity_client_singular ?? "cliente",
          platforms: selectedPlatforms,
        }),
      });
      if (!res.ok) throw new Error("Falha ao gerar sugestões.");
      const json = await res.json() as { suggestions: AiSuggestion[] };
      setSuggestions(json.suggestions.map((s) => ({ ...s, selected: true })));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro inesperado.", "error");
    } finally {
      setLoadingSuggestions(false);
    }
  }

  function toggleSuggestion(i: number) {
    setSuggestions((prev) =>
      prev.map((s, idx) => idx === i ? { ...s, selected: !s.selected } : s)
    );
  }

  async function addSelectedToPlanner() {
    const selected = suggestions.filter((s) => s.selected);
    if (!selected.length) {
      showToast("Selecione ao menos uma sugestão.", "warning");
      return;
    }
    setAddingToPlanner(true);
    try {
      const rows = selected.map((s) => ({
        title: s.title,
        content: "",
        image_url: null,
        scheduled_for: new Date(`${s.date}T${s.time}:00`).toISOString(),
        platforms: selectedPlatforms,
        status: "draft" as const,
        slug: slugify(s.title),
      }));
      const { error } = await supabase.from("marketing_posts").insert(rows);
      if (error) throw error;
      showToast(`${rows.length} post(s) adicionado(s) ao planner.`, "success");
      setSuggestions([]);
      setObjective("");
      setView("planner");
      void fetchPosts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao salvar.", "error");
    } finally {
      setAddingToPlanner(false);
    }
  }

  // ── Editor: geração de conteúdo via IA ───────────────────────────────────

  async function handleGenerateContent() {
    if (!title.trim()) {
      showToast("Insira um título antes de gerar o conteúdo.", "warning");
      return;
    }
    setIsGeneratingContent(true);
    setContent("");

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "content",
          title,
          companyName,
          niche: labels.entity_client_singular ?? "cliente",
          platforms: editorPlatforms,
        }),
      });

      if (!res.ok) throw new Error("Falha na geração.");
      if (!res.body) throw new Error("Sem resposta do servidor.");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

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
            const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            setContent((prev) => prev + chunk);
          } catch {
            // chunk inválido, ignora
          }
        }
      }
      showToast("Legenda gerada com sucesso.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro na geração.", "error");
    } finally {
      setIsGeneratingContent(false);
    }
  }

  // ── Editor: salvar post ───────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !scheduledFor) return;
    setIsSubmitting(true);

    const payload = {
      title,
      content,
      image_url: imageUrl || null,
      scheduled_for: new Date(scheduledFor).toISOString(),
      platforms: editorPlatforms,
      status: postStatus,
      slug: slugify(title),
    };

    const { error } = editId
      ? await supabase.from("marketing_posts").update(payload).eq("id", editId)
      : await supabase.from("marketing_posts").insert([payload]);

    if (!error) {
      showToast("Post salvo no planner.", "success");
      setView("planner");
      void fetchPosts();
    } else {
      showToast(error.message, "error");
    }
    setIsSubmitting(false);
  }

  // ── Editor: publicar no blog ──────────────────────────────────────────────

  async function handlePublishBlog() {
    if (!editId) {
      showToast("Salve o post antes de publicar.", "warning");
      return;
    }
    setIsPublishing(true);
    try {
      const res = await fetch("/api/blog/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editId,
          title,
          content,
          slug: slugify(title),
          image_url: imageUrl || null,
          scheduled_for: scheduledFor
            ? new Date(scheduledFor).toISOString()
            : new Date().toISOString(),
          platforms: editorPlatforms,
        }),
      });
      if (!res.ok) throw new Error("Falha ao publicar no blog.");
      // Atualiza status para published
      await supabase
        .from("marketing_posts")
        .update({ status: "published" })
        .eq("id", editId);
      setPostStatus("published");
      void fetchPosts();
      showToast("Publicado no blog com sucesso.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao publicar.", "error");
    } finally {
      setIsPublishing(false);
    }
  }

  // ── Editor: upload imagem ─────────────────────────────────────────────────

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const path = `marketing/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("axon-assets").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("axon-assets").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      showToast("Imagem enviada.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro no upload.", "error");
    }
  }

  // ── Abrir editor ──────────────────────────────────────────────────────────

  function openEditor(post?: MarketingPost) {
    if (post) {
      setEditId(post.id);
      setTitle(post.title);
      setContent(post.content);
      setImageUrl(post.image_url ?? "");
      setScheduledFor(toLocalDatetimeValue(post.scheduled_for));
      setEditorPlatforms(post.platforms ?? ["blog"]);
      setPostStatus(post.status);
    } else {
      setEditId(null);
      setTitle("");
      setContent("");
      setImageUrl("");
      setScheduledFor("");
      setEditorPlatforms(["blog"]);
      setPostStatus("scheduled");
    }
    setView("editor");
  }

  async function deletePost(id: string) {
    const { error } = await supabase.from("marketing_posts").delete().eq("id", id);
    if (!error) {
      showToast("Post excluído.", "success");
      setView("planner");
      void fetchPosts();
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative space-y-6 pb-12">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 rounded-lg border border-white/10 bg-[var(--color-surface)] px-5 py-3.5 shadow-2xl">
          {toast.type === "success"
            ? <Check size={18} className="shrink-0 text-[var(--color-cs-green)]" />
            : <AlertCircle size={18} className="shrink-0 text-red-400" />}
          <span className="text-sm font-semibold text-white">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-white/30 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PLANNER
      ══════════════════════════════════════════════════════════════════════ */}
      {view === "planner" && (
        <>
          {/* Header */}
          <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-[var(--color-surface)] p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Megaphone className="text-[var(--color-cs-green)]" size={22} />
              <div>
                <h3 className="text-lg font-bold text-white">{marketingLabel}</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Planner de conteúdo · {posts.length} post(s) cadastrado(s)
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setSuggestions([]); setObjective(""); setView("pauta"); }}
                className="flex items-center gap-2 rounded-md border border-[var(--color-cs-gold)]/30 bg-[var(--color-cs-gold)]/10 px-4 py-2 text-sm font-semibold text-[var(--color-cs-gold)] transition hover:bg-[var(--color-cs-gold)]/20"
              >
                <Sparkles size={15} /> Gerar pauta com IA
              </button>
              <button
                onClick={() => openEditor()}
                className="flex items-center gap-2 rounded-md bg-[var(--color-cs-green)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <Plus size={15} /> Novo post
              </button>
            </div>
          </div>

          {/* Calendário */}
          <div className="rounded-lg border border-white/10 bg-[var(--color-surface)] p-5">
            {/* Navegação do mês */}
            <div className="mb-6 flex items-center gap-3">
              <button
                onClick={calPrevMonth}
                className="rounded-md border border-white/10 p-1.5 text-[var(--color-text-secondary)] transition hover:border-white/30 hover:text-white"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="min-w-[160px] text-center text-sm font-semibold capitalize text-white">
                {calLabel}
              </span>
              <button
                onClick={calNextMonth}
                className="rounded-md border border-white/10 p-1.5 text-[var(--color-text-secondary)] transition hover:border-white/30 hover:text-white"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Grade */}
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
                <div key={d} className="pb-2 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {d}
                </div>
              ))}

              {/* Espaços vazios antes do primeiro dia */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const dayPosts = posts.filter((p) => {
                  const d = new Date(p.scheduled_for);
                  return (
                    d.getDate() === day &&
                    d.getMonth() === calMonth.month &&
                    d.getFullYear() === calMonth.year
                  );
                });
                const isToday =
                  new Date().getDate() === day &&
                  new Date().getMonth() === calMonth.month &&
                  new Date().getFullYear() === calMonth.year;

                return (
                  <div
                    key={day}
                    className={`group min-h-[80px] rounded-lg border p-1.5 transition md:min-h-[110px] md:p-2 ${
                      isToday
                        ? "border-[var(--color-cs-green)]/40 bg-[var(--color-cs-green)]/5"
                        : "border-white/5 bg-black/20 hover:border-white/15"
                    }`}
                  >
                    <span className={`text-xs font-bold ${isToday ? "text-[var(--color-cs-green)]" : "text-white/20 group-hover:text-white/40"}`}>
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayPosts.map((post) => (
                        <div
                          key={post.id}
                          onClick={() => openEditor(post)}
                          className={`cursor-pointer truncate rounded border-l-2 px-1 py-0.5 text-[8px] font-semibold transition hover:brightness-125 md:text-[9px] ${STATUS_STYLES[post.status]}`}
                        >
                          {post.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legenda */}
            <div className="mt-4 flex flex-wrap gap-4 border-t border-white/5 pt-4">
              {[
                { label: "Publicado",  cls: "border-[var(--color-cs-green)] bg-[var(--color-cs-green)]/10" },
                { label: "Agendado",   cls: "border-[var(--color-cs-gold)] bg-[var(--color-cs-gold)]/10"   },
                { label: "Rascunho",   cls: "border-zinc-500 bg-zinc-500/10"                               },
              ].map(({ label, cls }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-sm border-l-2 ${cls}`} />
                  <span className="text-[10px] text-[var(--color-text-secondary)]">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Lista de posts */}
          {!loading && posts.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-[var(--color-surface)] p-5">
              <h4 className="mb-4 text-sm font-semibold text-white">Todos os posts</h4>
              <div className="space-y-2">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => openEditor(post)}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-white/5 bg-black/20 px-4 py-3 transition hover:border-white/15"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{post.title}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {new Date(post.scheduled_for).toLocaleString("pt-BR", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span className={`ml-4 shrink-0 rounded border-l-2 px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[post.status]}`}>
                      {post.status === "published" ? "Publicado" :
                       post.status === "scheduled" ? "Agendado"  :
                       post.status === "draft"     ? "Rascunho"  : "Arquivado"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GERAR PAUTA COM IA
      ══════════════════════════════════════════════════════════════════════ */}
      {view === "pauta" && (
        <div className="mx-auto max-w-3xl space-y-6">
          <button
            onClick={() => setView("planner")}
            className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:text-white"
          >
            <ArrowLeft size={15} /> Voltar ao planner
          </button>

          {/* Instrução */}
          <div className="flex gap-3 rounded-lg border border-[var(--color-cs-gold)]/20 bg-[var(--color-cs-gold)]/5 p-4">
            <Info size={18} className="mt-0.5 shrink-0 text-[var(--color-cs-gold)]" />
            <div className="space-y-1 text-sm text-[var(--color-text-secondary)]">
              <p className="font-semibold text-white">Como funciona</p>
              <p>Descreva seu objetivo de marketing. A IA vai sugerir temas, datas e horários. Selecione os que quiser e adicione ao planner de uma vez. Depois, abra cada post para gerar a legenda.</p>
            </div>
          </div>

          <div className="space-y-6 rounded-lg border border-white/10 bg-[var(--color-surface)] p-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <Sparkles className="text-[var(--color-cs-gold)]" size={20} />
              <h2 className="text-lg font-bold text-white">Gerar pauta com IA</h2>
            </div>

            {/* Objetivo */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Objetivo da campanha
              </label>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                rows={3}
                placeholder="Ex: Lançar nova turma do curso de Excel, atrair alunos iniciantes de 18–35 anos…"
                className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-cs-green)]"
              />
            </div>

            {/* Plataformas */}
            <div>
              <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Plataformas
              </label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(({ id, label, Icon, color }) => {
                  const active = selectedPlatforms.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setSelectedPlatforms((prev) =>
                          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                        )
                      }
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                        active
                          ? "border-[var(--color-cs-green)]/40 bg-[var(--color-cs-green)]/10 text-white"
                          : "border-white/10 bg-black/20 text-[var(--color-text-secondary)] opacity-60 hover:opacity-100"
                      }`}
                    >
                      <Icon size={15} className={active ? color : ""} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleGenerateSuggestions()}
              disabled={loadingSuggestions}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-cs-green)] py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {loadingSuggestions
                ? <><Loader2 className="animate-spin" size={18} /> Gerando sugestões…</>
                : <><Zap size={18} /> Gerar sugestões de pauta</>}
            </button>
          </div>

          {/* Sugestões */}
          {suggestions.length > 0 && (
            <div className="space-y-4 rounded-lg border border-white/10 bg-[var(--color-surface)] p-6">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <CheckCircle size={16} className="text-[var(--color-cs-green)]" />
                  Sugestões geradas — selecione as que deseja adicionar
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSuggestions((p) => p.map((s) => ({ ...s, selected: true })))}
                    className="text-xs text-[var(--color-cs-green)] hover:underline"
                  >
                    Selecionar todas
                  </button>
                  <span className="text-white/20">·</span>
                  <button
                    onClick={() => setSuggestions((p) => p.map((s) => ({ ...s, selected: false })))}
                    className="text-xs text-[var(--color-text-secondary)] hover:underline"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => toggleSuggestion(i)}
                    className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition ${
                      s.selected
                        ? "border-[var(--color-cs-green)]/30 bg-[var(--color-cs-green)]/5"
                        : "border-white/5 bg-black/20 opacity-60"
                    }`}
                  >
                    {/* Checkbox visual */}
                    <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
                      s.selected
                        ? "border-[var(--color-cs-green)] bg-[var(--color-cs-green)]"
                        : "border-white/20 bg-transparent"
                    }`}>
                      {s.selected && <Check size={12} className="text-white" />}
                    </div>

                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-semibold text-white">{s.title}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{s.rationale}</p>
                      <div className="flex items-center gap-3 pt-1">
                        <span className="flex items-center gap-1 text-[10px] text-[var(--color-cs-gold)]">
                          <Calendar size={11} />
                          {new Date(`${s.date}T${s.time}`).toLocaleString("pt-BR", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void addSelectedToPlanner()}
                disabled={addingToPlanner || !suggestions.some((s) => s.selected)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-cs-green)] py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {addingToPlanner
                  ? <><Loader2 className="animate-spin" size={18} /> Adicionando…</>
                  : <><Calendar size={18} /> Adicionar selecionados ao planner</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          EDITOR DE POST
      ══════════════════════════════════════════════════════════════════════ */}
      {view === "editor" && (
        <div className="mx-auto max-w-5xl space-y-6">
          <button
            onClick={() => setView("planner")}
            className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:text-white"
          >
            <ArrowLeft size={15} /> Voltar ao planner
          </button>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* ── Formulário ────────────────────────────────────────────── */}
            <div className="space-y-6 lg:col-span-2">
              <div className="space-y-6 rounded-lg border border-white/10 bg-[var(--color-surface)] p-6">
                {/* Topo do editor */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <h3 className="flex items-center gap-2 text-base font-bold text-white">
                    <Edit size={18} className="text-[var(--color-cs-green)]" />
                    {editId ? "Editar post" : "Novo post"}
                  </h3>
                  {editId && postStatus !== "published" && (
                    <button
                      type="button"
                      onClick={() => void handlePublishBlog()}
                      disabled={isPublishing}
                      className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-400 transition hover:bg-blue-500/20 disabled:opacity-50"
                    >
                      {isPublishing ? <Loader2 className="animate-spin" size={14} /> : <Globe size={14} />}
                      Publicar no blog
                    </button>
                  )}
                </div>

                {/* Instrução de geração de legenda */}
                <div className="flex gap-3 rounded-lg border border-white/5 bg-black/20 p-3">
                  <Info size={15} className="mt-0.5 shrink-0 text-[var(--color-text-secondary)]" />
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Insira o <strong className="text-white">título</strong> e clique em <strong className="text-white">Gerar legenda</strong> para que a IA escreva o conteúdo automaticamente.
                  </p>
                </div>

                <form onSubmit={(e) => void handleSave(e)} className="space-y-5">
                  {/* Título + botão gerar */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      Título *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Título do post…"
                        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white outline-none placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-cs-green)]"
                      />
                      <button
                        type="button"
                        onClick={() => void handleGenerateContent()}
                        disabled={isGeneratingContent}
                        className="flex shrink-0 items-center gap-2 rounded-lg bg-[var(--color-cs-green)] px-4 py-2.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        {isGeneratingContent
                          ? <Loader2 className="animate-spin" size={15} />
                          : <Wand2 size={15} />}
                        {isGeneratingContent ? "Gerando…" : "Gerar legenda"}
                      </button>
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      Conteúdo / legenda
                    </label>
                    <textarea
                      ref={contentRef}
                      rows={12}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="O conteúdo gerado pela IA aparecerá aqui, ou escreva manualmente…"
                      className="w-full resize-y rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-cs-green)]"
                    />
                  </div>

                  {/* Data / hora */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        <Clock size={12} /> Data e hora *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={scheduledFor}
                        onChange={(e) => setScheduledFor(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--color-cs-green)] [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Status
                      </label>
                      <select
                        value={postStatus}
                        onChange={(e) => setPostStatus(e.target.value as MarketingPost["status"])}
                        className="w-full rounded-lg border border-white/10 bg-[var(--color-surface)] px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--color-cs-green)]"
                      >
                        <option value="draft">Rascunho</option>
                        <option value="scheduled">Agendado</option>
                        <option value="published">Publicado</option>
                      </select>
                    </div>
                  </div>

                  {/* Plataformas */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      Plataformas
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.map(({ id, label, Icon, color }) => {
                        const active = editorPlatforms.includes(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() =>
                              setEditorPlatforms((prev) =>
                                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                              )
                            }
                            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${
                              active
                                ? "border-[var(--color-cs-green)]/40 bg-[var(--color-cs-green)]/10 text-white"
                                : "border-white/10 bg-black/20 text-[var(--color-text-secondary)] opacity-60"
                            }`}
                          >
                            <Icon size={13} className={active ? color : ""} />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center justify-between border-t border-white/10 pt-5">
                    {editId && (
                      <button
                        type="button"
                        onClick={() => void deletePost(editId)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-red-400 transition hover:text-red-300"
                      >
                        <Trash2 size={14} /> Excluir post
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="ml-auto flex items-center gap-2 rounded-lg bg-[var(--color-cs-green)] px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                      Salvar
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* ── Preview lateral ───────────────────────────────────────── */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Preview
              </p>

              <div className="sticky top-6 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                {/* Avatar */}
                <div className="flex items-center gap-3 border-b border-white/10 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-cs-green)]/20 bg-[var(--color-cs-green)]/10 text-xs font-bold text-[var(--color-cs-green)]">
                    {companyName.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="text-xs font-bold text-white">{companyName}</p>
                </div>

                {/* Imagem */}
                <div
                  className="flex aspect-square w-full cursor-pointer items-center justify-center border-b border-white/10 bg-[var(--color-surface)] transition hover:brightness-110"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imageUrl
                    ? <img src={imageUrl} alt="Preview" className="h-full w-full object-cover" />
                    : (
                      <div className="flex flex-col items-center gap-2 text-[var(--color-text-secondary)]">
                        <Upload size={28} />
                        <span className="text-xs">Clique para adicionar imagem</span>
                      </div>
                    )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => void handleFileUpload(e)}
                  className="hidden"
                  accept="image/*"
                />

                {/* Conteúdo preview */}
                <div className="p-4">
                  {title && <p className="mb-2 text-xs font-bold text-white">{title}</p>}
                  <p className="line-clamp-8 text-xs leading-relaxed text-white/70">
                    {content || "Legenda aparecerá aqui…"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}