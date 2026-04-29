"use client";

export default function PortalFaturasPage() {
  return (
    <main className="min-h-screen bg-[#0d0807] text-white">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-[28px] border border-white/10 bg-[#1a1413] p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Faturas
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400 sm:text-base">
            Página temporária para estabilizar o deploy e validar o restante do portal.
          </p>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-[#1a1413] p-6">
          <p className="text-sm text-zinc-300">
            O módulo de faturas será reconstruído com integração real após a estabilização do sistema.
          </p>
        </section>
      </section>
    </main>
  );
}