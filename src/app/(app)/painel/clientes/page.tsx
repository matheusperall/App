import type { Metadata } from "next";
import Link from "next/link";
import { Placa } from "@/components/garagem";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { listarClientes } from "@/lib/dados";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage({ searchParams }: PageProps<"/painel/clientes">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const busca = typeof sp.q === "string" ? sp.q : "";
  const clientes = await listarClientes(busca);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-suave">Painel</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Clientes</h1>
        </div>
        <Link href="/painel/clientes/novo" className="botao-primario px-4 py-2.5 text-sm">+ Cliente</Link>
      </div>

      <form className="flex gap-2" role="search">
        <input
          name="q"
          defaultValue={busca}
          type="search"
          placeholder="Buscar por nome, e-mail, telefone ou placa"
          className="campo"
          aria-label="Buscar clientes"
        />
        <button type="submit" className="botao-escuro px-4">Buscar</button>
      </form>

      <Cartao className="p-0">
        {clientes.length === 0 ? (
          <p className="p-5 text-sm text-suave">
            {busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
          </p>
        ) : (
          <ul className="divide-y divide-borda">
            {clientes.map((c) => (
              <li key={c.id}>
                <Link href={`/painel/clientes/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-fundo">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.nome || "Sem nome"}</p>
                    <p className="truncate text-sm text-suave">{[c.email, c.telefone].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {c.veiculos.slice(0, 2).map((v) => <Placa key={v.id} placa={v.placa} tamanho="sm" />)}
                    {c.veiculos.length > 2 && <span className="self-center text-xs text-suave">+{c.veiculos.length - 2}</span>}
                    {c.veiculos.length === 0 && <span className="text-xs text-suave">sem veículo</span>}
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
