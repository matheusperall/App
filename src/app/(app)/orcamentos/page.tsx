import type { Metadata } from "next";
import Link from "next/link";
import { Vazio } from "@/components/gestao";
import { Cabecalho, CelulaStatus, ResumoPeriodo, type Cor } from "@/components/gestao/Cabecalho";
import { ItemListaOrcamento } from "@/components/orcamento";
import { Cartao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth";
import { listarOrcamentos, listarOrcamentosEmpresa, listarVeiculos, type OrcamentoComVeiculo } from "@/lib/dados";
import { CATEGORIAS, SITUACOES_ORCAMENTO, formatarData, formatarValor, nomeVeiculo, normalizarPlaca, orcamentoVencido } from "@/lib/garagem";
import { combina } from "@/lib/gestao";
import { listarFichas } from "@/lib/gestao-dados";
import { Icone } from "@/components/gestao/Icones";

export const metadata: Metadata = { title: "Orçamentos" };

const FILTROS = {
  responder: { rotulo: "A responder", situacoes: ["solicitado"] },
  cliente: { rotulo: "Aguardando cliente", situacoes: ["respondido"] },
  aprovados: { rotulo: "Aprovados", situacoes: ["aceito"] },
  todos: { rotulo: "Todos", situacoes: [] as string[] },
} as const;

const COR: Record<keyof typeof SITUACOES_ORCAMENTO, Cor> = { solicitado: "amarelo", respondido: "neutro", aceito: "verde", recusado: "vermelho", cancelado: "vermelho" };
const COLUNAS = "grid-cols-[6rem_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.8fr)_8rem_7rem_10rem]";
const soma = (l: OrcamentoComVeiculo[]) => l.reduce((t, o) => t + (o.valor_total ?? 0), 0);

export default async function OrcamentosPage({ searchParams }: PageProps<"/orcamentos">) {
  const [usuario, sp] = await Promise.all([exigirUsuario(), searchParams]);
  const admin = usuario.papel === "admin";

  if (admin) {
    const filtro = (typeof sp.f === "string" && sp.f in FILTROS ? sp.f : "responder") as keyof typeof FILTROS;
    const busca = typeof sp.q === "string" ? sp.q.trim() : "";
    const [todos, fichas] = await Promise.all([listarOrcamentosEmpresa(), busca ? listarFichas() : Promise.resolve([])]);
    const situacoes: readonly string[] = FILTROS[filtro].situacoes;
    // Com busca, procura em todos os orçamentos (número, placa, modelo, cliente, telefone ou pedido)
    const fichaDoVeiculo = new Map(fichas.flatMap((f) => f.veiculos.map((v) => [v.id, f] as const)));
    const placa = normalizarPlaca(busca);
    const lista = busca
      ? todos.filter((o) => {
          const v = o.veiculo;
          const f = fichaDoVeiculo.get(o.veiculo_id);
          if (busca.replace(/^#/, "") === String(o.numero)) return true;
          if (placa.length >= 2 && v?.placa.includes(placa)) return true;
          return combina([v?.marca, v?.modelo, v?.apelido, v?.dono?.nome, v?.dono?.telefone, f?.nome, f?.telefone, o.pedido, CATEGORIAS[o.categoria].rotulo].filter(Boolean).join(" "), busca);
        })
      : situacoes.length
        ? todos.filter((o) => situacoes.includes(o.situacao))
        : todos;
    const por = (s: string) => todos.filter((o) => o.situacao === s);
    return (
      <div className="space-y-4">
        <Cabecalho icone="orcamento" titulo="Orçamentos" acao={{ href: "/orcamentos/novo", rotulo: "Orçamento" }} />

        {/* Busca: número, placa, modelo, cliente, telefone ou pedido */}
        <section className="rounded-2xl border border-borda bg-white p-4">
          <form className="flex flex-col gap-2 sm:flex-row" role="search">
            <input name="q" defaultValue={busca} type="search" className="campo flex-1" placeholder="Número, placa, modelo, cliente, telefone ou pedido" aria-label="Buscar orçamento" />
            <button type="submit" className="botao-primario gap-1.5 rounded-full px-4 py-2.5 text-sm">
              <Icone nome="orcamento" className="h-4 w-4" />Buscar orçamento
            </button>
          </form>
          {busca && (
            <div className="mt-3 flex items-center justify-between gap-2 px-1 text-sm">
              <span className="text-suave">
                {lista.length} {lista.length === 1 ? "orçamento encontrado" : "orçamentos encontrados"} para <strong className="text-texto">“{busca}”</strong>
              </span>
              <Link href="/orcamentos" className="shrink-0 font-semibold text-marca-escura hover:underline">Limpar</Link>
            </div>
          )}
        </section>

        {!busca && (
          <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-borda bg-white p-1">
            {Object.entries(FILTROS).map(([k, v]) => (
              <Link key={k} href={`/orcamentos?f=${k}`} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${filtro === k ? "bg-tinta text-white" : "text-suave hover:text-texto"}`}>
                {v.rotulo}
              </Link>
            ))}
          </div>
        )}

        <ResumoPeriodo
          titulo="Resumo dos últimos orçamentos"
          itens={[
            { rotulo: `A responder (${por("solicitado").length})`, valor: por("solicitado").length, formato: "numero", cor: "amarelo" },
            { rotulo: `Aguardando cliente (${por("respondido").length})`, valor: soma(por("respondido")) },
            { rotulo: `Aprovados (${por("aceito").length})`, valor: soma(por("aceito")), cor: "verde" },
            { rotulo: `Recusados (${por("recusado").length})`, valor: soma(por("recusado")), cor: "vermelho" },
            { rotulo: "Taxa de aprovação", valor: por("aceito").length + por("recusado").length ? Math.round((por("aceito").length / (por("aceito").length + por("recusado").length)) * 100) : 0, formato: "porcento" },
          ]}
        />

        {lista.length === 0 ? (
          <div className="rounded-2xl border border-borda bg-white"><Vazio>Nenhum orçamento aqui.</Vazio></div>
        ) : (
          <div className="space-y-2">
            <div className={`hidden ${COLUNAS} rounded-xl border border-borda bg-white text-sm font-semibold lg:grid`}>
              <span className="px-4 py-3">Número</span>
              <span className="px-3 py-3">Cliente</span>
              <span className="px-3 py-3">Veículo</span>
              <span className="px-3 py-3">Pedido</span>
              <span className="px-3 py-3 text-right">Valor</span>
              <span className="px-3 py-3">Pedido em</span>
              <span className="px-4 py-3">Status</span>
            </div>
            <ul className="space-y-2">
              {lista.map((o) => {
                const vencido = orcamentoVencido(o);
                return (
                  <li key={o.id}>
                    <Link href={`/orcamentos/${o.id}`} className={`hidden ${COLUNAS} items-stretch overflow-hidden rounded-xl border border-borda bg-white text-sm transition hover:border-marca/60 hover:shadow-sm lg:grid`}>
                      <span className="px-4 py-3.5 font-semibold text-suave">#{o.numero}</span>
                      <span className="truncate px-3 py-3.5 font-medium">{o.veiculo?.dono?.nome ?? "—"}</span>
                      <span className="truncate px-3 py-3.5">
                        {o.veiculo && <><span className="mr-1.5 font-mono font-semibold">{o.veiculo.placa}</span><span className="text-suave">{nomeVeiculo(o.veiculo)}</span></>}
                      </span>
                      <span className="truncate px-3 py-3.5 text-suave">{CATEGORIAS[o.categoria].icone} {o.pedido || CATEGORIAS[o.categoria].rotulo}</span>
                      <span className="px-3 py-3.5 text-right font-semibold tabular-nums">{o.valor_total != null ? formatarValor(o.valor_total) : "—"}</span>
                      <span className="px-3 py-3.5 text-suave">{formatarData(o.criado_em)}</span>
                      <CelulaStatus texto={vencido ? "Expirado" : SITUACOES_ORCAMENTO[o.situacao].rotuloEmpresa} cor={vencido ? "neutro" : COR[o.situacao]} />
                    </Link>
                    <ul className="overflow-hidden rounded-2xl border border-borda bg-white lg:hidden"><ItemListaOrcamento o={o} empresa /></ul>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const veiculos = await listarVeiculos(usuario.id);
  const lista = await listarOrcamentos(veiculos.map((v) => v.id));

  return (
    <div className="space-y-4">
      <Cabecalho icone="orcamento" titulo="Orçamentos" acao={veiculos.length > 0 ? { href: "/orcamentos/novo", rotulo: "Pedir orçamento" } : undefined} />
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
