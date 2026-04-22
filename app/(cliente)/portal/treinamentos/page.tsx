"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { Play, Info, Loader2, Search, PlayCircle } from "lucide-react";
import Link from "next/link";

export default function LocFixAcademyPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const[featuredCourse, setFeaturedCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublishedCourses();
  },[]);

  const fetchPublishedCourses = async () => {
    setLoading(true);
    // Busca apenas os cursos que estão com status 'published'
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      // O curso mais recente vira o destaque do topo (Hero)
      setFeaturedCourse(data[0]);
      // Os demais vão para a grade abaixo
      setCourses(data.slice(1));
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[80vh] bg-background">
        <Loader2 className="animate-spin text-cs-green" size={48} />
      </div>
    );
  }

  if (!featuredCourse) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[80vh] bg-background text-center px-4">
        <PlayCircle size={64} className="text-surface/50 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Catálogo em Construção</h2>
        <p className="text-text-secondary max-w-md">
          A LOC FIX Academy está preparando os melhores treinamentos para você. Nenhum curso foi publicado ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background min-h-screen pb-20">
      
      {/* Hero Banner (Destaque Principal Estilo Netflix) */}
      <div className="relative w-full h-[60vh] md:h-[70vh] bg-surface flex items-center">
        {/* Imagem de Fundo com Gradientes para legibilidade */}
        <div className="absolute inset-0 overflow-hidden">
          {featuredCourse.thumbnail_url ? (
            <img 
              src={featuredCourse.thumbnail_url} 
              alt={featuredCourse.title} 
              className="w-full h-full object-cover object-top opacity-60"
            />
          ) : (
            <div className="w-full h-full bg-surface/80"></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
        </div>

        {/* Conteúdo do Destaque */}
        <div className="relative z-10 max-w-7xl mx-auto px-8 w-full">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-cs-green font-extrabold tracking-widest text-sm uppercase">
                LOC FIX Academy
              </span>
              <span className="text-xs font-medium px-2 py-0.5 bg-surface/80 border border-surface rounded text-white backdrop-blur-sm">
                Lançamento
              </span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 leading-tight drop-shadow-lg">
              {featuredCourse.title}
            </h1>
            
            <p className="text-lg text-gray-300 mb-8 line-clamp-3 drop-shadow-md">
              {featuredCourse.description || "Aprenda as melhores práticas de operação e montagem com os especialistas da CS com."}
            </p>
            
            <div className="flex items-center gap-4">
              <Link 
                href={`/portal/treinamentos/${featuredCourse.id}`}
                className="flex items-center gap-2 bg-white text-black px-8 py-3 rounded-md font-bold hover:bg-gray-200 transition-colors"
              >
                <Play size={20} className="fill-black" /> Assistir Agora
              </Link>
              <button className="flex items-center gap-2 bg-surface/50 border border-surface/50 text-white px-6 py-3 rounded-md font-bold hover:bg-surface transition-colors backdrop-blur-sm">
                <Info size={20} /> Mais Informações
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grade de Cursos (Catálogo) */}
      {courses.length > 0 && (
        <div className="max-w-7xl mx-auto px-8 mt-8 relative z-20">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Continuar Aprendendo</h3>
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
              <input 
                type="text" 
                placeholder="Buscar treinamentos..." 
                className="pl-9 pr-4 py-1.5 bg-surface border border-surface/50 rounded-full text-sm text-white focus:outline-none focus:border-cs-green w-64 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {courses.map((course) => (
              <Link 
                key={course.id} 
                href={`/portal/treinamentos/${course.id}`}
                className="group relative flex flex-col cursor-pointer"
              >
                {/* Capa do Curso (Pôster) */}
                <div className="w-full aspect-[2/3] bg-surface rounded-md overflow-hidden relative shadow-lg mb-3 border border-surface/50 transition-all duration-300 group-hover:scale-105 group-hover:border-cs-green/50 group-hover:shadow-[0_0_20px_rgba(19,137,70,0.2)]">
                  {course.thumbnail_url ? (
                    <img 
                      src={course.thumbnail_url} 
                      alt={course.title} 
                      className="w-full h-full object-cover"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-surface/50 bg-gradient-to-br from-surface to-background">
                      <PlayCircle size={32} />
                    </div>
                  )}
                  
                  {/* Overlay de Play no Hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center bg-black/50 text-white transform scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Play size={20} className="fill-white ml-1" />
                    </div>
                  </div>
                </div>
                
                {/* Título */}
                <h4 className="text-sm font-bold text-white leading-tight line-clamp-2 group-hover:text-cs-green transition-colors">
                  {course.title}
                </h4>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}