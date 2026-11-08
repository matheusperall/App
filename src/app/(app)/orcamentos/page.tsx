import type { Metadata } from "next";
import Link from "next/link";
import { ItemListaOrcamento } from "@/components/orcamento";
import { Cartao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth";
import { listarOrcamentos, listarOrcamentosEmpresa, listarVeiculos } from "@/lib/dados";

export const metadata: Metadata = { title: "Orçamentos" };

const FILTROS = {
  responder: { rotulo: "A responder", situacoes: ["solicitado"] },
  cliente: { rotulo: "Aguardando cliente", situacoes: ["respondido"] },
  aprovados: { rotulo: "Aprovados", situacoes: ["aceito"] },
  todos: { rotulo: "Todos", situacoes: [] as string[] },
} as const;

export default async function OrcamentosPage({ searchParams }: PageProps<"/orcamentos">) {
  const [usuario, sp] = await Promise.all([exigirUsuario(), searchParams]);
  const admin = usuario.papel === "admin";

  if (admin) {
    const filtro = (typeof sp.f === "string" && sp.f in FILTROS ? sp.f : "responder") as keyof typeof FILTROS;
    const lista = await listarOrcamentosEmpresa([...FILTROS[filtro].situacoes]);
    return (
      <div className="space-y-5">
        <div>
          <p className="text-suave">Área da empresa</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Orçamentos</h1>
        </div>
        <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {Object.entries(FILTROS).map(([k, v]) => (
            <Link
              key={k}
              href={`/orcamentos?f=${k}`}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${filtro === k ? "bg-tinta text-white" : "border border-borda bg-white text-suave"}`}
            >
              {v.rotulo}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-suave">
          Para enviar um orçamento por conta própria, abra o veículo do cliente e toque em <strong>Enviar orçamento</strong>.
        </p>
        <Cartao className="p-0">
          {lista.length === 0 ? (
            <p className="p-5 text-sm text-suave">Nenhum orçamento aqui.</p>
          ) : (
            <ul className="divide-y divide-borda">
              {lista.map((o) => <ItemListaOrcamento key={o.id} o={o} empresa />)}
            </ul>
          )}
        </Cartao>
      </div>
    );
  }

  const veiculos = await listarVeiculos(usuario.id);
  const lista = await listarOrcamentos(veiculos.map((v) => v.id));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">Orçamentos</h1>
        {veiculos.length > 0 && <Link href="/orcamentos/novo" className="botao-primario px-4 py-2.5 text-sm">+ Pedir orçamento</Link>}
      </div>
      {veiculos.length === 0 ? (
        <Cartao className="space-y-3 text-center">
          <p className="text-suave">Cadastre seu veículo para pedir orçamentos.</p>
          <Link href="/garagem/novo" className="botao-primario">Cadastrar veículo</Link>
        </Cartao>
      ) : lista.length === 0 ? (
        <Cartao className="space-y-3 py-8 text-center">
          <div className="text-4xl" aria-hidden="true">💬</div>
          <h2 className="font-semibold">Precisa de algum serviço?</h2>
          <p className="mx-auto max-w-sm text-sm text-suave">
            Mande fotos e conte o que precisa: estética, funilaria, pintura, mecânica, elétrica ou acessórios. Respondemos
            com o valor e o prazo aqui no app.
          </p>
          <Link href="/orcamentos/novo" className="botao-primario">Pedir orçamento</Link>
        </Cartao>
      ) : (
        <Cartao className="p-0">
          <ul className="divide-y divide-borda">
            {lista.map((o) => <ItemListaOrcamento key={o.id} o={o} />)}
          </ul>
        </Cartao>
      )}
    </div>
  );
}
