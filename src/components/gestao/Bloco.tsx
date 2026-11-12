import type { ReactNode } from "react";
import { Icone, type NomeIcone } from "./Icones";

/** Cartão com título e ícone à esquerda e um destaque à direita (padrão do painel). */
export function Bloco({
  icone,
  titulo,
  direita,
  children,
  className = "",
  semEspaco = false,
}: {
  icone: NomeIcone;
  titulo: string;
  direita?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Sem espaçamento interno (para listas que ocupam o cartão todo) */
  semEspaco?: boolean;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-borda bg-white ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-borda px-4 py-3 text-sm">
        <h2 className="flex items-center gap-2 font-semibold"><Icone nome={icone} className="h-4 w-4 text-suave" />{titulo}</h2>
        {direita && <div className="text-right">{direita}</div>}
      </div>
      <div className={semEspaco ? "" : "p-4"}>{children}</div>
    </section>
  );
}

/** Número grande com legenda ao lado (ex.: "3 orçamentos pendentes"). */
export function Contagem({ n, legenda, cor = "text-marca-escura" }: { n: ReactNode; legenda: string; cor?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`font-titulo text-2xl font-bold whitespace-nowrap tabular-nums ${cor}`}>{n}</span>
      <span className="text-xs leading-tight text-suave">{legenda}</span>
    </div>
  );
}
