import type { Metadata } from "next";
import Link from "next/link";
import { Dinheiro, NavMes, Titulo, Vazio } from "@/components/gestao";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { formatarData, hojeISO, somarDias } from "@/lib/garagem";
import { arred, mesAtual, mesValido, type OrdemServico } from "@/lib/gestao";
import { listarOS, type FiltroOS } from "@/lib/gestao-dados";
import { ItemOS } from "./ItemOS";

export const metadata: Metadata = { title: "Ordens de serviço" };

const FILTROS: { chave: FiltroOS; rotulo: string }[] = [
  { chave: "todas", rotulo: "Todas" },
  { chave: "patio", rotulo: "No pátio" },
  { chave: "receber", rotulo: "A receber" },
  { chave: "lojistas", rotulo: "Lojistas" },
];

/** Agrupa as OS por dia, do mais recente para o mais antigo (mantendo a ordem dentro do dia). */
function porDia(lista: OrdemServico[]) {
  const grupos = new Map<string, OrdemServico[]>();
  for (const o of [...lista].sort((a, b) => b.data.localeCompare(a.data))) grupos.set(o.data, [...(grupos.get(o.data) ?? []), o]);
  return [...grupos].map(([dia, os]) => ({ dia, os }));
}

function rotuloDia(dia: string) {
  const hoje = hojeISO();
  if (dia === hoje) return "Hoje";
  if (dia === somarDias(hoje, -1)) return "Ontem";
  const semana = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(new Date(`${dia}T12:00:00Z`));
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${formatarData(dia).slice(0, 5)}${dia.slice(0, 4) === hoje.slice(0, 4) ? "" : `/${dia.slice(0, 4)}`}`;
}

export default async function ListaOSPage({ searchParams }: PageProps<"/gestao/os">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const filtro = (FILTROS.find((f) => f.chave === sp.f)?.chave ?? "todas") as FiltroOS;
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
          <div>
            {porDia(lista).map((g) => (
              <section key={g.dia} aria-label={rotuloDia(g.dia)}>
                <h2 className="flex items-center justify-between gap-3 border-b border-borda bg-fundo px-5 py-2 text-sm font-semibold">
                  <span>{rotuloDia(g.dia)} <span className="font-normal text-suave">· {g.os.length} OS</span></span>
                  <Dinheiro valor={arred(g.os.filter((o) => o.status !== "cancelada").reduce((t, o) => t + o.total, 0))} />
                </h2>
                <ul className="divide-y divide-borda border-b border-borda last:border-b-0">{g.os.map((o) => <ItemOS key={o.id} os={o} />)}</ul>
              </section>
            ))}
          </div>
        )}
      </Cartao>
    </div>
  );
}
