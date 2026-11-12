import type { Metadata } from "next";
import Link from "next/link";
import { Placa } from "@/components/garagem";
import { Selo, Vazio } from "@/components/gestao";
import { Cabecalho, ResumoPeriodo } from "@/components/gestao/Cabecalho";
import { exigirAdmin } from "@/lib/auth";
import { formatarData, formatarValor } from "@/lib/garagem";
import { arred } from "@/lib/gestao";
import { listarFichas } from "@/lib/gestao-dados";

export const metadata: Metadata = { title: "Clientes" };

const COLUNAS = "grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.4fr)_8rem_8rem_6rem]";

export default async function ClientesGestaoPage({ searchParams }: PageProps<"/gestao/clientes">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const busca = typeof sp.q === "string" ? sp.q : "";
  const filtro = sp.f === "lojistas" ? "lojistas" : sp.f === "app" ? "app" : "todos";
  const todos = await listarFichas(busca);
  const fichas = filtro === "lojistas" ? todos.filter((f) => f.lojista) : filtro === "app" ? todos.filter((f) => f.perfil_id) : todos;
  const total = arred(todos.reduce((t, f) => t + f.total_gasto, 0));
  const comOS = todos.filter((f) => f.qtd_os > 0);

  return (
    <div className="space-y-4">
      <Cabecalho icone="clientes" titulo="Clientes" acao={{ href: "/gestao/clientes/novo", rotulo: "Novo cliente" }} />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <form className="flex flex-1 items-center gap-2 rounded-xl border border-borda bg-white px-3" role="search">
          {filtro !== "todos" && <input type="hidden" name="f" value={filtro} />}
          <input name="q" defaultValue={busca} type="search" placeholder="Buscar por nome, telefone ou placa" className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none" aria-label="Buscar clientes" />
          <button type="submit" className="text-sm font-semibold text-marca-escura">Buscar</button>
        </form>
        <div className="flex gap-1 rounded-xl border border-borda bg-white p-1">
          {([["todos", "Todos"], ["lojistas", "Lojistas"], ["app", "Com app"]] as const).map(([f, r]) => (
            <Link key={f} href={`/gestao/clientes?${f !== "todos" ? `f=${f}&` : ""}${busca ? `q=${encodeURIComponent(busca)}` : ""}`} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${filtro === f ? "bg-tinta text-white" : "text-suave hover:text-texto"}`}>
              {r}
            </Link>
          ))}
        </div>
      </div>

      <ResumoPeriodo
        titulo="Resumo"
        itens={[
          { rotulo: "Clientes", valor: todos.length, formato: "numero" },
          { rotulo: "Lojistas", valor: todos.filter((f) => f.lojista).length, formato: "numero" },
          { rotulo: "Com acesso ao app", valor: todos.filter((f) => f.perfil_id).length, formato: "numero" },
          { rotulo: "Total gasto (todos)", valor: total, cor: "verde" },
          { rotulo: "Gasto médio por cliente", valor: comOS.length ? arred(total / comOS.length) : 0, cor: "verde" },
        ]}
      />

      {fichas.length === 0 ? (
        <div className="rounded-2xl border border-borda bg-white"><Vazio>{busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</Vazio></div>
      ) : (
        <div className="space-y-2">
          <div className={`hidden ${COLUNAS} rounded-xl border border-borda bg-white text-sm font-semibold lg:grid`}>
            <span className="px-4 py-3">Cliente</span>
            <span className="px-3 py-3">Telefone</span>
            <span className="px-3 py-3">Veículos</span>
            <span className="px-3 py-3 text-right">Total gasto</span>
            <span className="px-3 py-3">Última visita</span>
            <span className="px-3 py-3">App</span>
          </div>
          <ul className="space-y-2">
            {fichas.map((c) => (
              <li key={c.id}>
                <Link href={`/gestao/clientes/${c.id}`} className="block rounded-xl border border-borda bg-white text-sm transition hover:border-marca/60 hover:shadow-sm">
                  <div className={`hidden ${COLUNAS} items-center lg:grid`}>
                    <span className="flex min-w-0 items-center gap-2 px-4 py-3">
                      <span className="truncate font-medium">{c.nome || "Sem nome"}</span>
                      {c.lojista && <Selo classe="bg-marca-clara text-marca-escura">Lojista</Selo>}
                    </span>
                    <span className="truncate px-3 py-3 text-suave">{c.telefone ?? "—"}</span>
                    <span className="flex min-w-0 flex-wrap gap-1 px-3 py-2">
                      {c.veiculos.slice(0, 3).map((v) => <Placa key={v.id} placa={v.placa} tamanho="sm" />)}
                      {c.veiculos.length > 3 && <span className="self-center text-xs text-suave">+{c.veiculos.length - 3}</span>}
                      {c.veiculos.length === 0 && <span className="text-suave">—</span>}
                    </span>
                    <span className="px-3 py-3 text-right font-semibold text-sucesso tabular-nums">{formatarValor(c.total_gasto)}</span>
                    <span className="px-3 py-3 text-suave">{c.ultima_visita ? formatarData(c.ultima_visita) : "—"}</span>
                    <span className="px-3 py-3">{c.perfil_id ? <span className="font-semibold text-sucesso">Sim</span> : <span className="text-suave">Não</span>}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3 px-4 py-3 lg:hidden">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium">
                        <span className="truncate">{c.nome || "Sem nome"}</span>
                        {c.lojista && <Selo classe="bg-marca-clara text-marca-escura">Lojista</Selo>}
                        {!c.perfil_id && <Selo>sem app</Selo>}
                      </p>
                      <p className="truncate text-suave">{c.telefone ?? c.email ?? "—"}</p>
                      <p className="text-xs text-suave">
                        <span className="font-semibold text-sucesso">{formatarValor(c.total_gasto)}</span> · {c.ultima_visita ? `última visita ${formatarData(c.ultima_visita)}` : "sem visitas"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {c.veiculos.slice(0, 2).map((v) => <Placa key={v.id} placa={v.placa} tamanho="sm" />)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
