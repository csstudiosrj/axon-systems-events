"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Megaphone, Plus, Loader2, ArrowLeft, Calendar, Image as ImageIcon, Instagram, Globe, CheckCircle, Clock, Save, Trash2, Edit } from "lucide-react";

export default function MarketingPage() {
  const [view, setView] = useState<"list" | "create">("list");
  const [posts, setPosts] = useState<any[]>([]);
  const[loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados do Formulário
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const[scheduledFor, setScheduledFor] = useState("");
  const [platformInstagram, setPlatformInstagram] = useState(true);
  const[platformBlog, setPlatformBlog] = useState(true);
  const [status, setStatus] = useState("scheduled");

  useEffect(() => {
    if (view === "list") fetchPosts();
  }, [view]);

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("marketing_posts")
      .select("*")
      .order("scheduled_for", { ascending: true });
      
    if (!error && data) setPosts(data);
    setLoading(false);
  };

  const resetForm = () => {
    setEditId(null);
    setTitle("");
    setContent("");
    setImageUrl("");
    setScheduledFor("");
    setPlatformInstagram(true);
    setPlatformBlog(true);
    setStatus("scheduled");
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content || !scheduledFor) return;

    setIsSubmitting(true);

    const payload = {
      title,
      content,
      image_url: imageUrl || null,
      scheduled_for: new Date(scheduledFor).toISOString(),
      platform_instagram: platformInstagram,
      platform_blog: platformBlog,
      status
    };

    let error;

    if (editId) {
      const { error: updateError } = await supabase.from("marketing_posts").update(payload).eq("id", editId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from("marketing_posts").insert([payload]);
      error = insertError;
    }

    if (!error) {
      resetForm();
      setView("list");
    } else {
      alert("Erro ao salvar postagem: " + error.message);
    }
    setIsSubmitting(false);
  };

  const handleEdit = (post: any) => {
    setEditId(post.id);
    setTitle(post.title);
    setContent(post.content);
    setImageUrl(post.image_url || "");
    
    // Formata a data do banco para o input datetime-local (YYYY-MM-DDThh:mm)
    const dateObj = new Date(post.scheduled_for);
    const formattedDate = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setScheduledFor(formattedDate);
    
    setPlatformInstagram(post.platform_instagram);
    setPlatformBlog(post.platform_blog);
    setStatus(post.status);
    setView("create");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este agendamento?")) return;
    const { error } = await supabase.from("marketing_posts").delete().eq("id", id);
    if (!error) fetchPosts();
  };

  if (view === "create") {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <button onClick={() => { resetForm(); setView("list"); }} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} /> Voltar para o Calendário
          </button>
        </div>

        <div className="bg-surface border border-surface/50 p-6 rounded-lg flex flex-col md:flex-row gap-8">
          
          {/* Formulário */}
          <div className="flex-1 space-y-6">
            <h3 className="text-lg font-medium text-white flex items-center gap-2 border-b border-surface/50 pb-4">
              <Megaphone className="text-cs-green" size={20} />
              {editId ? "Editar Agendamento" : "Agendar Nova Postagem"}
            </h3>
            
            <form id="post-form" onSubmit={handleSavePost} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Título Interno / Título do Blog *</label>
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="Ex: Lançamento do novo painel de LED" />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Conteúdo / Legenda do Instagram *</label>
                <textarea required rows={6} value={content} onChange={(e) => setContent(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors resize-none" placeholder="Escreva o texto da sua postagem aqui..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">URL da Imagem (Link)</label>
                <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="https://exemplo.com/imagem.jpg" />
                <p className="text-xs text-text-secondary mt-1">Cole o link da imagem. O upload direto será ativado na próxima fase.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Data e Hora da Publicação *</label>
                  <input type="datetime-local" max="2099-12-31T23:59" required value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors">
                    <option value="draft">Rascunho (Não publicar)</option>
                    <option value="scheduled">Agendado (Aguardando data)</option>
                    <option value="published">Publicado</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-surface/50">
                <label className="block text-sm font-medium text-text-secondary mb-3">Onde publicar?</label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={platformInstagram} onChange={(e) => setPlatformInstagram(e.target.checked)} className="rounded border-surface bg-background text-cs-green focus:ring-cs-green w-4 h-4" />
                    <span className="text-sm text-white flex items-center gap-1.5"><Instagram size={16} className="text-pink-500" /> Instagram</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={platformBlog} onChange={(e) => setPlatformBlog(e.target.checked)} className="rounded border-surface bg-background text-cs-green focus:ring-cs-green w-4 h-4" />
                    <span className="text-sm text-white flex items-center gap-1.5"><Globe size={16} className="text-blue-400" /> Blog do Site</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-8 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {editId ? "Atualizar Postagem" : "Agendar Postagem"}
                </button>
              </div>
            </form>
          </div>

          {/* Preview do Post (Simulação Visual) */}
          <div className="w-full md:w-80 shrink-0">
            <h4 className="text-sm font-medium text-text-secondary mb-4 uppercase tracking-wider">Preview da Postagem</h4>
            <div className="bg-background border border-surface/50 rounded-xl overflow-hidden shadow-lg">
              {/* Header do Preview */}
              <div className="p-3 flex items-center gap-2 border-b border-surface/50">
                <div className="w-8 h-8 rounded-full bg-cs-green flex items-center justify-center text-xs font-bold text-white">CS</div>
                <div>
                  <p className="text-xs font-bold text-white">cscomeventos</p>
                  <p className="text-[10px] text-text-secondary">
                    {scheduledFor ? new Date(scheduledFor).toLocaleString('pt-BR') : 'Data não definida'}
                  </p>
                </div>
              </div>
              
              {/* Imagem do Preview */}
              <div className="w-full aspect-square bg-surface flex items-center justify-center overflow-hidden">
                {imageUrl ? (
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <ImageIcon size={32} className="text-surface/50" />
                )}
              </div>
              
              {/* Texto do Preview */}
              <div className="p-4">
                <p className="text-xs text-white whitespace-pre-wrap line-clamp-4">
                  <span className="font-bold mr-1">cscomeventos</span>
                  {content || "Sua legenda aparecerá aqui..."}
                </p>
              </div>
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
          <Megaphone className="text-cs-green" size={20} />
          Automação de Marketing (Blog & Social)
        </h3>
        <button
          onClick={() => { resetForm(); setView("create"); }}
          className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all"
        >
          <Plus size={18} /> Agendar Postagem
        </button>
      </div>

      {/* Tabela de Agendamentos */}
      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-6 py-3 font-medium">Postagem</th>
                <th className="px-6 py-3 font-medium">Data Agendada</th>
                <th className="px-6 py-3 font-medium">Plataformas</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} /> Carregando calendário...
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">
                    Nenhuma postagem agendada. Clique em "Agendar Postagem" para começar.
                  </td>
                </tr>
              ) : (
                posts.map((post) => (
                  <tr key={post.id} className="hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-background border border-surface/50 flex items-center justify-center overflow-hidden shrink-0">
                          {post.image_url ? <img src={post.image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={16} className="text-text-secondary" />}
                        </div>
                        <div>
                          <p className="font-medium text-white truncate max-w-xs">{post.title}</p>
                          <p className="text-xs mt-0.5 truncate max-w-xs">{post.content}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-cs-gold" />
                        <span className="font-medium text-white">
                          {new Date(post.scheduled_for).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="text-xs ml-1">
                          às {new Date(post.scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {post.platform_instagram && <Instagram size={16} className="text-pink-500" title="Instagram" />}
                        {post.platform_blog && <Globe size={16} className="text-blue-400" title="Blog do Site" />}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        post.status === 'published' ? 'bg-cs-green/10 text-cs-green border-cs-green/20' :
                        post.status === 'draft' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                        'bg-cs-gold/10 text-cs-gold border-cs-gold/20'
                      }`}>
                        {post.status === 'published' ? <CheckCircle size={12} /> : <Clock size={12} />}
                        {post.status === 'published' ? 'Publicado' : post.status === 'draft' ? 'Rascunho' : 'Agendado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => handleEdit(post)} className="text-text-secondary hover:text-cs-gold transition-colors">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(post.id)} className="text-text-secondary hover:text-red-500 transition-colors">
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