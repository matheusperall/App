import type { ReactNode } from "react";
import { Voltar } from "@/components/garagem";
import { Icone, type NomeIcone } from "@/components/gestao/Icones";

/**
 * Página de cadastro em formato de ficha: ocupa a largura da tela como as outras abas,
 * com o título no topo e o aviso de que * marca os campos obrigatórios.
 */
export function PaginaFicha({
  voltar,
  icone,
  titulo,
  descricao,
  menu,
  children,
}: {
  voltar: { href: string; rotulo: ReactNode };
  icone: NomeIcone;
  titulo: string;
  descricao?: ReactNode;
  /** Menu da seção acima da ficha (ex.: menu da Gestão) */
  menu?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {menu}
      <Voltar href={voltar.href}>{voltar.rotulo}</Voltar>
      <header className="flex flex-col gap-1 rounded-2xl border border-borda bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
            <Icone nome={icone} className="h-6 w-6 shrink-0 text-marca-escura" />
            {titulo}
          </h1>
          {descricao && <div className="mt-0.5 text-sm text-suave">{descricao}</div>}
        </div>
        <p className="shrink-0 text-xs text-suave">
          <span className="font-bold text-perigo">*</span> campos obrigatórios
        </p>
      </header>
      {children}
    </div>
  );
}
