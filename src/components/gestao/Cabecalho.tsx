import Link from "next/link";
import type { ReactNode } from "react";
import { formatarValor } from "@/lib/garagem";
import { Icone, type NomeIcone } from "./Icones";

export type SubAba = { href: string; rotulo: string; ativa: boolean; icone?: NomeIcone };

/**
 * Cabeçalho de cada tela da Gestão: ícone e título, sub-abas da seção e o botão principal à direita.
 */
export function Cabecalho({
  icone,
  titulo,
  abas = [],
  acao,
  extra,
}: {
  icone: NomeIcone;
  titulo: string;
  abas?: SubAba[];
  acao?: { href: string; rotulo: string };
  extra?: ReactNode;
}) {
  return (
    <header className="rounded-2xl border border-borda bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-4">
          <h1 className="flex shrink-0 items-center gap-2 text-lg font-bold sm:text-xl">
            <Icone nome={icone} className="h-6 w-6 text-marca-escura" />
            {titulo}
          </h1>
          {abas.length > 0 && (
            <nav aria-label={`Seções de ${titulo}`} className="hidden items-center gap-1 border-l border-borda pl-3 md:flex">
              {abas.map((a) => <LinkAba key={a.href} a={a} />)}
            </nav>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {extra}
          {acao && (
            <Link href={acao.href} className="botao-primario gap-1.5 rounded-full px-4 py-2 text-sm sm:px-5">
              <Icone nome="mais" className="h-4 w-4" />
              {acao.rotulo}
            </Link>
          )}
        </div>
      </div>
      {abas.length > 0 && (
        <nav aria-label={`Seções de ${titulo}`} className="flex gap-1 overflow-x-auto border-t border-borda px-2 md:hidden">
          {abas.map((a) => <LinkAba key={a.href} a={a} />)}
        </nav>
      )}
    </header>
  );
}

function LinkAba({ a }: { a: SubAba }) {
  return (
    <Link
      href={a.href}
      aria-current={a.ativa ? "page" : undefined}
      className={`flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-sm font-medium md:py-2 ${a.ativa ? "border-marca text-texto" : "border-transparent text-suave hover:text-texto"}`}
    >
      {a.icone && <Icone nome={a.icone} className="h-4 w-4" />}
      {a.rotulo}
    </Link>
  );
}

export type Cor = "verde" | "amarelo" | "vermelho" | "neutro";
export const COR_TEXTO: Record<Cor, string> = {
  verde: "text-sucesso",
  amarelo: "text-[#b07800]",
  vermelho: "text-perigo",
  neutro: "text-texto",
};

/** "Resumo do período": vários números lado a lado, coloridos pelo significado. */
export function ResumoPeriodo({
  titulo = "Resumo do período",
  itens,
}: {
  titulo?: string;
  itens: { rotulo: string; valor: number; cor?: Cor; formato?: "dinheiro" | "numero" | "porcento"; dica?: string; sinal?: boolean; href?: string }[];
}) {
  const formatar = (v: number, f: "dinheiro" | "numero" | "porcento" = "dinheiro", sinal?: boolean) =>
    f === "numero"
      ? v.toLocaleString("pt-BR")
      : f === "porcento"
        ? `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
        : `${sinal && v > 0 ? "+" : ""}${formatarValor(v)}`;
  return (
    <section className="rounded-2xl border border-borda bg-white px-4 py-4 sm:px-5">
      <h2 className="mb-3 text-sm font-semibold">{titulo}</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {itens.map((i) => (
          <div
            key={i.rotulo}
            className={`min-w-0 ${i.href ? "group relative -m-1.5 rounded-lg p-1.5 transition hover:bg-fundo" : ""}`}
            title={i.dica}
          >
            <dt className="truncate text-xs text-suave sm:text-sm">{i.rotulo}</dt>
            <dd className={`truncate font-titulo text-base font-bold tabular-nums sm:text-lg ${COR_TEXTO[i.cor ?? "neutro"]}`}>
              {formatar(i.valor, i.formato, i.sinal)}
              {i.href && <span className="ml-1.5 text-xs font-semibold text-marca-escura group-hover:underline">ver ›</span>}
            </dd>
            {i.href && <Link href={i.href} className="absolute inset-0 rounded-lg" aria-label={`Ver ${i.rotulo.toLowerCase()}`} />}
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Cabeçalho de grupo nas listas: mês em destaque e o dia logo abaixo. */
export function GrupoMes({ titulo }: { titulo: string }) {
  return <h2 className="px-1 pt-3 font-titulo text-lg font-bold first:pt-0">{titulo}</h2>;
}
export function GrupoDia({ titulo, direita }: { titulo: string; direita?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-1 pt-1 text-sm text-suave">
      <span className="shrink-0">{titulo}</span>
      <span className="h-px flex-1 bg-borda" />
      {direita && <span className="shrink-0 tabular-nums">{direita}</span>}
    </div>
  );
}

/** Etiqueta de categoria (borda colorida e fundo suave). */
const TONS = [
  "border-[#e3a008]/50 bg-[#fff7e0] text-[#8a5a00]",
  "border-[#6d5bd0]/40 bg-[#f1efff] text-[#4b3aa8]",
  "border-[#12b5b0]/40 bg-marca-clara text-marca-escura",
  "border-[#e0603a]/40 bg-[#fff0ea] text-[#b2431f]",
  "border-[#3a7be0]/40 bg-[#ecf3ff] text-[#2357a8]",
  "border-[#1f9d55]/40 bg-sucesso-claro text-sucesso",
];
export function Etiqueta({ texto }: { texto: string }) {
  let h = 0;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return <span className={`inline-block max-w-full truncate rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONS[h % TONS.length]}`}>{texto}</span>;
}

/** Status na última coluna: texto colorido com um leve degradê. */
export function CelulaStatus({ texto, cor }: { texto: string; cor: Cor }) {
  const fundo = { verde: "from-sucesso-claro", amarelo: "from-alerta-claro", vermelho: "from-perigo-claro", neutro: "from-fundo" }[cor];
  return <span className={`flex h-full items-center bg-gradient-to-r ${fundo} to-transparent px-4 font-semibold ${COR_TEXTO[cor]}`}>{texto}</span>;
}
