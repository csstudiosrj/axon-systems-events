"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { useSettings } from "../../../providers/SettingsProvider";
import {
  BookOpen,
  Search,
  ArrowLeft,
  Loader2,
  MessageSquare,
  ChevronRight,
  FileText,
} from "lucide-react";

type Department = "support" | "financial" | "commercial" | "administrative" | "hr";

const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: "support", label: "Suporte" },
  { value: "financial", label: "Financeiro" },
  { value: "commercial", label: "Comercial" },
  { value: "administrative", label: "Administrativo" },
  { value: "hr", label: "RH" },
];

type KBArticle = {
  id: string;
  title: string;
  content: string;
  department: Department;
  created_at: string;
};

export default function PortalAjudaPage() {
  const router = useRouter();
  const { systemPreferences } = useSettings();

  const supportEnabled = systemPreferences?.feature_toggles?.enable_support ?? true;
  const labels = systemPreferences?.custom_labels;
  const supportMenuLabel = labels?.menu_support || "Suporte";

  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<Department | "all">("all");
  const [openArticle, setOpenArticle] = useState<KBArticle | null>(null);

  const getDepartmentLabel = (dept: Department) =>
    DEPARTMENTS.find((d) => d.value === dept)?.label || dept;

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("id, title, content, department, created_at")
      .order("created_at", { ascending: false });

    setArticles(!error && data ? (data as KBArticle[]) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supportEnabled) {
      router.replace("/portal");
      return;
    }
    fetchArticles();
  }, [supportEnabled, router, fetchArticles]);

  const filteredArticles = articles.filter((article) => {
    const matchesDept =
      activeFilter === "all" || article.department === activeFilter;
    const matchesSearch =
      searchQuery.trim() === "" ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const articlesByDept = DEPARTMENTS.map((dept) => ({
    ...dept,
    count: articles.filter((a) => a.department === dept.value).length,
  })).filter((d) => d.count > 0);

  if (!supportEnabled) return null;

  // ─── Article reader ──────────────────────────────────────────────────────────
  if (openArticle) {
    return (
      <div className="flex-1 bg-background p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <button
            onClick={() => setOpenArticle(null)}
            className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
          >
            <ArrowLeft size={20} /> Voltar para a Base de Conhecimento
          </button>

          <div className="bg-surface border border-surface/50 p-8 rounded-2xl shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <BookOpen size={18} className="text-cs-gold" />
              <span className="text-xs text-text-secondary uppercase tracking-wider">
                Base de Conhecimento
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {getDepartmentLabel(openArticle.department)}
              </span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-8">{openArticle.title}</h2>

            <div className="text-text-secondary leading-relaxed whitespace-pre-wrap text-sm">
              {openArticle.content}
            </div>

            <div className="mt-10 pt-6 border-t border-surface/50">
              <p className="text-sm font-medium text-white mb-2">
                Este artigo resolveu seu problema?
              </p>
              <p className="text-xs text-text-secondary mb-5">
                Se não, nossa equipe está pronta para ajudar diretamente.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setOpenArticle(null)}
                  className="flex items-center gap-2 rounded-lg bg-cs-green text-white py-2.5 px-5 text-sm font-bold hover:bg-opacity-90 transition-all"
                >
                  Sim, problema resolvido
                </button>
                <button
                  onClick={() => router.push("/portal/suporte")}
                  className="flex items-center gap-2 rounded-lg border border-surface/50 bg-surface text-text-secondary py-2.5 px-5 text-sm font-medium hover:text-white hover:border-cs-gold/30 transition-all"
                >
                  <MessageSquare size={16} /> Abrir chamado de {supportMenuLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main list view ──────────────────────────────────────────────────────────
  return (
    <div className="flex-1 bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-surface border border-surface/50 p-6 rounded-2xl shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="text-cs-gold" size={28} />
            <h2 className="text-2xl font-bold text-white">Base de Conhecimento</h2>
          </div>
          <p className="text-text-secondary">
            Encontre respostas rápidas para as dúvidas mais comuns antes de abrir
            um chamado.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar artigos..."
            className="w-full rounded-xl border border-surface bg-surface pl-12 pr-4 py-4 text-white focus:border-cs-gold focus:outline-none focus:ring-1 focus:ring-cs-gold transition-colors text-sm"
          />
        </div>

        {/* Department filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeFilter === "all"
                ? "bg-cs-gold text-black"
                : "bg-surface border border-surface/50 text-text-secondary hover:text-white"
            }`}
          >
            Todos ({articles.length})
          </button>
          {articlesByDept.map((dept) => (
            <button
              key={dept.value}
              onClick={() => setActiveFilter(dept.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeFilter === dept.value
                  ? "bg-cs-gold text-black"
                  : "bg-surface border border-surface/50 text-text-secondary hover:text-white"
              }`}
            >
              {dept.label} ({dept.count})
            </button>
          ))}
        </div>

        {/* Articles */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-cs-gold" size={36} />
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="bg-surface border border-surface/50 rounded-2xl p-12 text-center">
            <FileText size={48} className="mx-auto text-surface/50 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              Nenhum artigo encontrado
            </h3>
            <p className="text-text-secondary mb-6">
              Não encontramos artigos para essa pesquisa.
            </p>
            <button
              onClick={() => router.push("/portal/suporte")}
              className="flex items-center gap-2 rounded-lg bg-cs-gold text-black py-2.5 px-5 text-sm font-bold hover:bg-opacity-90 transition-all mx-auto"
            >
              <MessageSquare size={16} /> Abrir um chamado
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredArticles.map((article) => (
              <button
                key={article.id}
                onClick={() => setOpenArticle(article)}
                className="text-left bg-surface border border-surface/50 rounded-2xl p-6 hover:border-cs-gold/30 transition-colors group flex items-start gap-4 shadow-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-cs-gold/10 border border-cs-gold/20 flex items-center justify-center shrink-0 group-hover:bg-cs-gold/20 transition-colors">
                  <FileText size={18} className="text-cs-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-purple-500/10 text-purple-400 border-purple-500/20">
                      {getDepartmentLabel(article.department)}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-cs-gold transition-colors mb-1 line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="text-xs text-text-secondary line-clamp-2">
                    {article.content.substring(0, 120)}
                    {article.content.length > 120 ? "..." : ""}
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className="text-text-secondary group-hover:text-cs-gold transition-colors shrink-0 mt-1"
                />
              </button>
            ))}
          </div>
        )}

        {/* CTA if no article helps */}
        {!loading && filteredArticles.length > 0 && (
          <div className="bg-surface border border-surface/50 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-bold text-white">Não encontrou o que precisava?</p>
              <p className="text-sm text-text-secondary mt-1">
                Nossa equipe está pronta para ajudar diretamente.
              </p>
            </div>
            <button
              onClick={() => router.push("/portal/suporte")}
              className="flex items-center gap-2 rounded-lg bg-cs-gold text-black py-3 px-6 font-bold hover:bg-opacity-90 transition-all shrink-0"
            >
              <MessageSquare size={18} /> Abrir chamado
            </button>
          </div>
        )}
      </div>
    </div>
  );
}