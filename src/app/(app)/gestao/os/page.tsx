import type { Metadata } from "next";
import Link from "next/link";
import { NavMes, Vazio } from "@/components/gestao";
import { Cabecalho, CelulaStatus, GrupoDia, GrupoMes, ResumoPeriodo, type Cor } from "@/components/gestao/Cabecalho";
import { exigirAdmin } from "@/lib/auth";
import { formatarValor } from "@/lib/garagem";
import { STATUS_OS, agruparPorMesEDia, arred, concluida, faltaReceber, mesAtual, mesValido, rotuloDia, rotuloForma, tituloMes, type OrdemServico } from "@/lib/gestao";
import { listarOS, type FiltroOS } from "@/lib/gestao-dados";
import { ItemOS } from "./ItemOS";

export const metadata: Metadata = { title: "Ordens de serviço" };

const FILTROS: { chave: FiltroOS; rotulo: string }[] = [
  { chave: "todas", rotulo: "Todas" },
  { chave: "patio", rotulo: "No pátio" },
  { chave: "receber", rotulo: "A receber" },
  { chave: "lojistas", rotulo: "Lojistas" },
];

const COR_STATUS: Record<OrdemServico["status"], Cor> = { aberta: "amarelo", em_andamento: "amarelo", pronta: "verde", entregue: "verde", cancelada: "vermelho" };

function pagamento(o: OrdemServico): { texto: string; cor: Cor } {
  if (o.status === "cancelada") return { texto: "—", cor: "neutro" };
  if (o.pago) return { texto: o.forma_pagamento ? rotuloForma(o.forma_pagamento, o.parcelas) : "Pago", cor: "verde" };
  if ((o.valor_pago ?? 0) > 0) return { texto: `Parcial · falta ${formatarValor(faltaReceber(o))}`, cor: "amarelo" };
  if (o.cliente?.lojista) return { texto: o.fatura_id ? "Na fatura" : "A faturar", cor: "amarelo" };
  return concluida(o.status) ? { texto: "A receber", cor: "amarelo" } : { texto: "—", cor: "neutro" };
}

const COLUNAS = "grid-cols-[5.5rem_minmax(0,1.4fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_7.5rem_9rem_9rem]";

export default async function ListaOSPage({ searchParams }: PageProps<"/gestao/os">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const filtro = (FILTROS.find((f) => f.chave === sp.f)?.chave ?? "todas") as FiltroOS;
  const mes = mesValido(sp.mes) ? sp.mes : mesAtual();
  const busca = typeof sp.q === "string" ? sp.q : "";
  const lista = await listarOS({ filtro, mes, busca });
  const validas = lista.filter((o) => o.status !== "cancelada");
  const soma = (l: OrdemServico[]) => arred(l.reduce((t, o) => t + o.total, 0));
  const concluidas = validas.filter((o) => concluida(o.status));
  const abertas = validas.filter((o) => !concluida(o.status));
  const aReceber = concluidas.filter((o) => !o.pago);
  const comMes = !busca && (filtro === "todas" || filtro === "lojistas");
  const link = (f: FiltroOS) => `/gestao/os?f=${f}${mesValido(sp.mes) ? `&mes=${mes}` : ""}`;
  const grupos = agruparPorMesEDia(lista, (o) => o.data);

  return (
    <div className="space-y-4">
      <Cabecalho icone="os" titulo="Ordens de serviço" acao={{ href: "/gestao/os/nova", rotulo: "Nova OS" }} />

      {/* Filtros numa linha */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        {comMes && <div className="lg:w-72"><NavMes mes={mes} base="/gestao/os" params={{ f: filtro }} /></div>}
        <form className="flex flex-1 items-center gap-2 rounded-xl border border-borda bg-white px-3" role="search">
          <input type="hidden" name="f" value={filtro} />
          {mesValido(sp.mes) && <input type="hidden" name="mes" value={mes} />}
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-suave" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input name="q" defaultValue={busca} type="search" className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none" placeholder="Buscar por placa, cliente ou nº da OS" aria-label="Buscar OS" />
        </form>
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-borda bg-white p-1">
          {FILTROS.map((f) => (
            <Link key={f.chave} href={link(f.chave)} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${filtro === f.chave ? "bg-tinta text-white" : "text-suave hover:text-texto"}`}>
              {f.rotulo}
            </Link>
          ))}
        </div>
      </div>
      {busca && (
        <p className="text-sm text-suave">
          Resultado da busca por “{busca}”. <Link href={link(filtro)} className="font-semibold text-marca-escura">Limpar</Link>
        </p>
      )}

      <ResumoPeriodo
        itens={[
          { rotulo: `Total (${validas.length} OS)`, valor: soma(validas), cor: "verde" },
          { rotulo: `Concluídas (${concluidas.length})`, valor: soma(concluidas), cor: "verde" },
          { rotulo: `Em aberto (${abertas.length})`, valor: soma(abertas), cor: "amarelo" },
          { rotulo: "A receber", valor: arred(aReceber.reduce((t, o) => t + faltaReceber(o), 0)), cor: "amarelo" },
          { rotulo: "Ticket médio", valor: validas.length ? arred(soma(validas) / validas.length) : 0, cor: "verde" },
          { rotulo: "Taxas de recebimento", valor: arred(validas.reduce((t, o) => t + o.taxa_valor, 0)), cor: "vermelho" },
        ]}
      />

      {lista.length === 0 ? (
        <div className="rounded-2xl border border-borda bg-white">
          <Vazio>{filtro === "patio" && !busca ? "Nenhum carro no pátio agora." : "Nenhuma OS encontrada."}</Vazio>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Títulos das colunas (computador) */}
          <div className={`hidden ${COLUNAS} items-center rounded-xl border border-borda bg-white px-0 text-sm font-semibold lg:grid`}>
            <span className="px-4 py-3">Número</span>
            <span className="px-3 py-3">Cliente</span>
            <span className="px-3 py-3">Veículo</span>
            <span className="px-3 py-3">Serviços</span>
            <span className="px-3 py-3 text-right">Valor</span>
            <span className="px-3 py-3">Pagamento</span>
            <span className="px-4 py-3">Status</span>
          </div>

          {grupos.map((m) => (
            <section key={m.mes} className="space-y-2">
              <GrupoMes titulo={tituloMes(m.mes)} />
              {m.dias.map((d) => (
                <div key={d.dia} className="space-y-2">
                  <GrupoDia titulo={rotuloDia(d.dia)} direita={`${d.itens.length} OS · ${formatarValor(soma(d.itens.filter((o) => o.status !== "cancelada")))}`} />
                  {/* Computador: linhas da tabela */}
                  <ul className="hidden space-y-2 lg:block">
                    {d.itens.map((o) => {
                      const p = pagamento(o);
                      return (
                        <li key={o.id}>
                          <Link href={`/gestao/os/${o.id}`} className={`grid ${COLUNAS} items-stretch overflow-hidden rounded-xl border border-borda bg-white text-sm transition hover:border-marca/60 hover:shadow-sm`}>
                            <span className="px-4 py-3.5 font-semibold text-suave">#{o.numero}</span>
                            <span className="truncate px-3 py-3.5 font-medium">{o.cliente?.nome}</span>
                            <span className="truncate px-3 py-3.5">
                              {o.placa && <span className="mr-1.5 font-mono font-semibold">{o.placa}</span>}
                              <span className="text-suave">{o.veiculo_nome}</span>
                            </span>
                            <span className="truncate px-3 py-3.5 text-suave">{o.itens.map((i) => i.nome).join(", ") || "—"}</span>
                            <span className="px-3 py-3.5 text-right font-semibold tabular-nums">{formatarValor(o.total)}</span>
                            <span className={`truncate px-3 py-3.5 ${p.cor === "verde" ? "text-sucesso" : p.cor === "amarelo" ? "text-[#b07800]" : "text-suave"}`}>{p.texto}</span>
                            <CelulaStatus texto={STATUS_OS[o.status].rotulo} cor={COR_STATUS[o.status]} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {/* Celular: cartões */}
                  <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-white lg:hidden">
                    {d.itens.map((o) => <ItemOS key={o.id} os={o} />)}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
