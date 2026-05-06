"use client";

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSettings } from "../../providers/SettingsProvider";
import {
  BookOpen,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  X,
  Save,
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

type FormState = {
  title: string;
  content: string;
  department: Department;
};

const EMPTY_FORM: FormState = {
  title: "",
  content: "",
  department: "support",
};

export default function KnowledgeBasePage() {
  const { systemPreferences } = useSettings();
  const labels = systemPreferences?.custom_labels;
  const supportMenuLabel = labels?.menu_support || "Suporte";

  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [activeFilter, setActiveFilter] = useState<Department | "all">("all");

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
    fetchArticles();
  }, [fetchArticles]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (article: KBArticle) => {
    setEditingId(article.id);
    setForm({
      title: article.title,
      content: article.content,
      department: article.department,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;

    setIsSaving(true);

    if (editingId) {
      await supabase
        .from("knowledge_base")
        .update({
          title: form.title.trim(),
          content: form.content.trim(),
          department: form.department,
        })
        .eq("id", editingId);
    } else {
      await supabase.from("knowledge_base").insert([
        {
          title: form.title.trim(),
          content: form.content.trim(),
          department: form.department,
        },
      ]);
    }

    await fetchArticles();
    setIsSaving(false);
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este artigo?")) return;
    setIsDeleting(id);
    await supabase.from("knowledge_base").delete().eq("id", id);
    await fetchArticles();
    setIsDeleting(null);
  };

  const filteredArticles = articles.filter(
    (a) => activeFilter === "all" || a.department === activeFilter
  );

  const articlesByDept = DEPARTMENTS.map((dept) => ({
    ...dept,
    count: articles.filter((a) => a.department === dept.value).length,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg">
        <div>
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <BookOpen className="text-cs-green" size={20} />
            Base de Conhecimento
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            Artigos exibidos no portal do cliente para reduzir chamados de{" "}
            {supportMenuLabel.toLowerCase()}.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-cs-green text-white py-2.5 px-5 text-sm font-bold hover:bg-opacity-90 transition-all"
        >
          <Plus size={18} /> Novo Artigo
        </button>
      </div>

      {/* Department filter tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFilter("all")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeFilter === "all"
              ? "bg-cs-green text-white"
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
                ? "bg-cs-green text-white"
                : "bg-surface border border-surface/50 text-text-secondary hover:text-white"
            }`}
          >
            {dept.label} ({dept.count})
          </button>
        ))}
      </div>

      {/* Articles table */}
      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-xs uppercase">
              <tr>
                <th className="px-6 py-4 font-medium">Artigo</th>
                <th className="px-6 py-4 font-medium">Departamento</th>
                <th className="px-6 py-4 font-medium">Criado em</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center">
                    <Loader2
                      className="animate-spin mx-auto text-cs-green"
                      size={24}
                    />
                  </td>
                </tr>
              ) : filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center">
                    <FileText
                      size={40}
                      className="mx-auto text-surface/50 mb-3"
                    />
                    <p className="text-text-secondary">
                      Nenhum artigo publicado ainda.
                    </p>
                    <button
                      onClick={openCreate}
                      className="mt-4 text-cs-green text-sm hover:underline"
                    >
                      Criar o primeiro artigo
                    </button>
                  </td>
                </tr>
              ) : (
                filteredArticles.map((article) => (
                  <tr
                    key={article.id}
                    className="hover:bg-background/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="font-bold text-white">{article.title}</p>
                      <p className="text-xs text-text-secondary mt-1 line-clamp-1 max-w-md">
                        {article.content.substring(0, 100)}
                        {article.content.length > 100 ? "..." : ""}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-[10px] font-bold uppercase border bg-purple-500/10 text-purple-400 border-purple-500/20">
                        {getDepartmentLabel(article.department)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {new Date(article.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(article)}
                          className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-surface transition-colors"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(article.id)}
                          disabled={isDeleting === article.id}
                          className="p-2 rounded-lg text-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          title="Excluir"
                        >
                          {isDeleting === article.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
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

      {/* Modal create/edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface/50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-surface/50 shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen size={20} className="text-cs-green" />
                {editingId ? "Editar Artigo" : "Novo Artigo"}
              </h3>
              <button
                onClick={closeModal}
                className="text-text-secondary hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="flex flex-col flex-1 min-h-0 overflow-y-auto"
            >
              <div className="p-6 space-y-5 flex-1">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Departamento *
                  </label>
                  <select
                    required
                    value={form.department}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        department: e.target.value as Department,
                      }))
                    }
                    className="block w-full rounded-lg border border-surface bg-background px-4 py-3 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Título do artigo *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="block w-full rounded-lg border border-surface bg-background px-4 py-3 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
                    placeholder="Ex: Como solicitar reembolso de despesas"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Conteúdo *
                  </label>
                  <textarea
                    required
                    rows={12}
                    value={form.content}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, content: e.target.value }))
                    }
                    className="block w-full rounded-lg border border-surface bg-background px-4 py-3 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors resize-none font-mono text-sm"
                    placeholder="Escreva o conteúdo do artigo aqui. Use parágrafos para organizar as informações..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-surface/50 shrink-0">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-surface/50 bg-background text-text-secondary py-2.5 px-5 text-sm font-medium hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-lg bg-cs-green text-white py-2.5 px-6 text-sm font-bold hover:bg-opacity-90 transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>
                      <Save size={16} />
                      {editingId ? "Salvar alterações" : "Publicar artigo"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}