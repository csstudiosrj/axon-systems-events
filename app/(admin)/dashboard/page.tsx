"use client";

import React from "react";
import { FileText, Truck, Ticket } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-surface border border-surface/50 p-6 rounded-lg">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-cs-green/10 rounded-md text-cs-green">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm text-text-secondary">Orçamentos Pendentes</p>
            <p className="text-2xl font-bold text-white">12</p>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-surface/50 p-6 rounded-lg">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-cs-gold/10 rounded-md text-cs-gold">
            <Truck size={24} />
          </div>
          <div>
            <p className="text-sm text-text-secondary">Eventos na Semana</p>
            <p className="text-2xl font-bold text-white">4</p>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-surface/50 p-6 rounded-lg">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-red-500/10 rounded-md text-red-500">
            <Ticket size={24} />
          </div>
          <div>
            <p className="text-sm text-text-secondary">Chamados Abertos</p>
            <p className="text-2xl font-bold text-white">3</p>
          </div>
        </div>
      </div>
    </div>
  );
}