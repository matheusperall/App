import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho } from "@/components/gestao/Cabecalho";
import { Icone } from "@/components/gestao/Icones";
import { Aviso } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import type { CategoriaFinanceira } from "@/lib/gestao";
import { listarCategorias } from "@/lib/gestao-dados";
import { abasFinanceiro } from "../abas";
import { FormCategoria } from "./FormCategoria";
import { rotuloDre } from "./grupos";

export const metadata: Metadata = { title: "Categorias do financeiro" };

/** Cor fixa de cada grupo do DRE */
const COR_DRE: Record<string, string> = {
  receita: "border-sucesso/40 bg-sucesso-claro text-sucesso",
  despesa: "border-perigo/30 bg-perigo-claro text-perigo",
  taxa: "border-[#e3a008]/50 bg-[#fff7e0] text-[#8a5a00]",
  estoque: "border-[#6d5bd0]/40 bg-[#f1efff] text-[#4b3aa8]",
  fora: "border-borda bg-fundo text-suave",
};

const LAPIS = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
);

export default async function CategoriasPage({ searchParams }: PageProps<"/gestao/financeiro/categorias">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const categorias = await listarCategorias();
  const editando = typeof sp.editar === "string" ? categorias.find((c) => c.id === sp.editar) : undefined;
  const nova = sp.nova === "entrada" || sp.nova === "saida" ? sp.nova : null;

  const lista = (tipo: "entrada" | "saida", titulo: string, icone: "entrada" | "saida") => {
    const itens = categorias.filter((c) => c.tipo === tipo).sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.nome.localeCompare(b.nome));
    return (
      <section className="min-w-0 rounded-2xl border border-borda bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-borda px-4 py-3">
          <h2 className="flex items-center gap-2 font-semibold"><Icone nome={icone} className="h-4 w-4 text-suave" />{titulo} <span className="text-sm font-normal text-suave">({itens.length})</span></h2>
          <Link href={`/gestao/financeiro/categorias?nova=${tipo}#editar`} scroll={false} className="text-sm font-semibold text-marca-escura">+ Nova</Link>
        </div>
        <ul className="divide-y divide-borda">
          {itens.map((c: CategoriaFinanceira) => (
            <li key={c.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${c.ativa ? "" : "opacity-50"} ${editando?.id === c.id ? "bg-marca-clara/40" : ""}`}>
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.nome}{!c.ativa && " · inativa"}{c.sistema && <span className="text-xs font-normal text-suave"> · do sistema</span>}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${COR_DRE[c.dre] ?? COR_DRE.fora}`}>{rotuloDre(c.tipo, c.dre)}</span>
                <Link href={`/gestao/financeiro/categorias?editar=${c.id}#editar`} scroll={false} aria-label={`Editar ${c.nome}`} title="Editar" className="rounded-lg p-1.5 text-suave hover:bg-fundo hover:text-marca-escura">{LAPIS}</Link>
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  };

  return (
    <div className="space-y-4">
      <Cabecalho icone="financeiro" titulo="Financeiro" abas={abasFinanceiro("categorias")} />
      {typeof sp.salvo === "string" && <Aviso tipo="sucesso">{sp.salvo}</Aviso>}
      <p className="px-1 text-sm text-suave">
        Categorias usadas nos lançamentos. A coluna da direita mostra em qual linha do <strong className="text-texto">Resultado (DRE)</strong> cada uma aparece. Toque no lápis para editar.
      </p>

      {(editando || nova) && (
        <div id="editar" className="scroll-mt-24 space-y-3 rounded-2xl border border-marca/40 bg-marca-clara/30 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">{editando ? `Editar categoria: ${editando.nome}` : `Nova categoria de ${nova === "entrada" ? "entrada" : "saída"}`}</h3>
            <Link href="/gestao/financeiro/categorias" scroll={false} className="text-sm font-semibold text-suave hover:text-texto">Fechar ✕</Link>
          </div>
          <FormCategoria key={editando?.id ?? nova ?? ""} categoria={editando} tipoInicial={nova ?? "saida"} />
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {lista("entrada", "Entradas", "entrada")}
        {lista("saida", "Saídas", "saida")}
      </div>
    </div>
  );
}
