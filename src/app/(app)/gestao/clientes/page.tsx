import type { Metadata } from "next";
import Link from "next/link";
import { Placa } from "@/components/garagem";
import { Dinheiro, Selo, Titulo, Vazio } from "@/components/gestao";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { formatarData } from "@/lib/garagem";
import { listarFichas } from "@/lib/gestao-dados";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesGestaoPage({ searchParams }: PageProps<"/gestao/clientes">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const busca = typeof sp.q === "string" ? sp.q : "";
  const filtro = sp.f === "lojistas" ? "lojistas" : "todos";
  const todos = await listarFichas(busca);
  const fichas = filtro === "lojistas" ? todos.filter((f) => f.lojista) : todos;

  return (
    <div className="space-y-4">
      <Titulo pre="Gestão" titulo="Clientes">
        <Link href="/gestao/clientes/novo" className="botao-primario px-4 py-2.5 text-sm">+ Cliente</Link>
      </Titulo>
      <form className="flex gap-2" role="search">
        {filtro === "lojistas" && <input type="hidden" name="f" value="lojistas" />}
        <input name="q" defaultValue={busca} type="search" placeholder="Buscar por nome, telefone ou placa" className="campo" aria-label="Buscar clientes" />
        <button type="submit" className="botao-escuro px-4">Buscar</button>
      </form>
      <div className="flex gap-2">
        {(["todos", "lojistas"] as const).map((f) => (
          <Link key={f} href={`/gestao/clientes?${f === "lojistas" ? "f=lojistas&" : ""}${busca ? `q=${encodeURIComponent(busca)}` : ""}`} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${filtro === f ? "border-tinta bg-tinta text-white" : "border-borda bg-white text-suave"}`}>
            {f === "todos" ? "Todos" : "Lojistas"}
          </Link>
        ))}
      </div>
      <Cartao className="p-0">
        {fichas.length === 0 ? (
          <Vazio>{busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</Vazio>
        ) : (
          <ul className="divide-y divide-borda">
            {fichas.map((c) => (
              <li key={c.id}>
                <Link href={`/gestao/clientes/${c.id}`} className="flex items-start justify-between gap-3 px-5 py-4 transition hover:bg-fundo">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 font-medium">
                      <span className="truncate">{c.nome || "Sem nome"}</span>
                      {c.lojista && <Selo classe="bg-marca-clara text-marca-escura">Lojista</Selo>}
                      {!c.perfil_id && <Selo>sem app</Selo>}
                    </p>
                    <p className="truncate text-sm text-suave">{c.telefone ?? c.email ?? "—"}</p>
                    <p className="text-xs text-suave">
                      Total gasto <Dinheiro valor={c.total_gasto} /> · {c.ultima_visita ? `última visita ${formatarData(c.ultima_visita)}` : "sem visitas"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {c.veiculos.slice(0, 2).map((v) => <Placa key={v.id} placa={v.placa} tamanho="sm" />)}
                    {c.veiculos.length > 2 && <span className="self-center text-xs text-suave">+{c.veiculos.length - 2}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
