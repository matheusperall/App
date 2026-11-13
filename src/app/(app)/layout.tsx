import Link from "next/link";
import { Suspense } from "react";
import { AvisoConfiguracao } from "@/components/AvisoConfiguracao";
import { Logo } from "@/components/Logo";
import { Navegacao } from "./Navegacao";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Topo fino, numa linha só: logo · menu principal (computador) · avisos e conta */}
      <header className="sticky top-0 z-20 bg-tinta pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-3 px-4 sm:h-14 sm:gap-5 sm:px-6">
          <Link href="/inicio" aria-label="Início" className="shrink-0">
            <Logo claro compacto />
          </Link>
          <Suspense fallback={<div className="flex-1" />}>
            <Navegacao local="barra" />
          </Suspense>
          <Suspense>
            <Navegacao local="topo" />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-28 sm:px-6 sm:pb-10">
        <div className="mb-4 empty:hidden">
          <AvisoConfiguracao />
        </div>
        <Suspense fallback={<Carregando />}>{children}</Suspense>
      </main>

      <Suspense>
        <Navegacao local="rodape" />
      </Suspense>
    </div>
  );
}

function Carregando() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-borda" />
      <div className="h-40 animate-pulse rounded-2xl bg-borda/70" />
    </div>
  );
}
