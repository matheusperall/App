import Link from "next/link";
import { Suspense } from "react";
import { AvisoConfiguracao } from "@/components/AvisoConfiguracao";
import { Logo } from "@/components/Logo";
import { Navegacao } from "./Navegacao";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20">
        <div className="bg-tinta pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/inicio" aria-label="Início">
            <Logo claro />
          </Link>
          <Suspense>
            <Navegacao local="topo" />
          </Suspense>
        </div>
        </div>
        <Suspense>
          <Navegacao local="barra" />
        </Suspense>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-28 sm:px-6 sm:pb-10">
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
