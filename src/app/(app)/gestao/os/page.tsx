import type { Metadata } from "next";
import Link from "next/link";
import { Dinheiro, NavMes, Titulo, Vazio } from "@/components/gestao";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { arred, mesAtual, mesValido } from "@/lib/gestao";
import { listarOS, type FiltroOS } from "@/lib/gestao-dados";
import { ItemOS } from "./ItemOS";

export const metadata: Metadata = { title: "Ordens de serviço" };

const FILTROS: { chave: FiltroOS; rotulo: string }[] = [
  { chave: "patio", rotulo: "No pátio" },
  { chave: "receber", rotulo: "A receber" },
  { chave: "lojistas", rotulo: "Lojistas" },
  { chave: "todas", rotulo: "Todas" },
];

export default async function ListaOSPage({ searchParams }: PageProps<"/gestao/os">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const filtro = (FILTROS.find((f) => f.chave === sp.f)?.chave ?? "patio") as FiltroOS;
  const mes = mesValido(sp.mes) ? sp.mes : mesAtual();
  const busca = typeof sp.q === "string" ? sp.q : "";
  const lista = await listarOS({ filtro, mes, busca });
  const total = arred(lista.filter((o) => o.status !== "cancelada").reduce((t, o) => t + o.total, 0));
  const comMes = !busca && (filtro === "todas" || filtro === "lojistas");
  const link = (f: FiltroOS) => `/gestao/os?f=${f}${mesValido(sp.mes) ? `&mes=${mes}` : ""}`;

  return (
    <div className="space-y-4">
      <Titulo pre="Gestão" titulo="Ordens de serviço">
        <Link href="/gestao/os/nova" className="botao-primario px-4 py-2.5 text-sm">+ Nova OS</Link>
      </Titulo>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Link
            key={f.chave}
            href={link(f.chave)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${filtro === f.chave ? "border-tinta bg-tinta text-white" : "border-borda bg-white text-suave hover:text-texto"}`}
          >
            {f.rotulo}
          </Link>
        ))}
      </div>

      <form className="flex gap-2" role="search">
        <input type="hidden" name="f" value={filtro} />
        {mesValido(sp.mes) && <input type="hidden" name="mes" value={mes} />}
        <input name="q" defaultValue={busca} type="search" className="campo" placeholder="Placa, cliente ou nº da OS" aria-label="Buscar OS" />
        <button type="submit" className="botao-escuro px-4">Buscar</button>
      </form>

      {comMes && <NavMes mes={mes} base="/gestao/os" params={{ f: filtro }} />}
      {busca && (
        <p className="text-sm text-suave">
          Resultado da busca por “{busca}”. <Link href={link(filtro)} className="font-semibold text-marca-escura">Limpar</Link>
        </p>
      )}

      <Cartao className="p-0">
        <div className="flex items-center justify-between border-b border-borda px-5 py-3 text-sm">
          <span className="text-suave">{lista.length} {lista.length === 1 ? "OS" : "OS"}</span>
          <span>Total: <Dinheiro valor={total} className="font-semibold" /></span>
        </div>
        {lista.length === 0 ? (
          <Vazio>{filtro === "patio" && !busca ? "Nenhum carro no pátio agora." : "Nenhuma OS encontrada."}</Vazio>
        ) : (
          <ul className="divide-y divide-borda">{lista.map((o) => <ItemOS key={o.id} os={o} />)}</ul>
        )}
      </Cartao>
    </div>
  );
}
