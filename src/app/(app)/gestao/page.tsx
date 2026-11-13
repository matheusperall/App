import type { Metadata } from "next";
import Link from "next/link";
import { Dinheiro, NavMes, SeloFatura, SeloProduto } from "@/components/gestao";
import { CalendarioMes } from "@/components/gestao/Calendario";
import { GraficoDias } from "@/components/gestao/GraficoDias";
import { GraficoFormas } from "@/components/gestao/GraficoFormas";
import { Bloco, Contagem } from "@/components/gestao/Bloco";
import { EditarVagas } from "@/components/gestao/EditarVagas";
import { Icone } from "@/components/gestao/Icones";
import { exigirAdmin, primeiroNome } from "@/lib/auth";
import { formatarQuando, partesBrasilia } from "@/lib/agenda";
import { agendaEmpresa, agendamentosEntre, contarOrcamentosAResponder, contarPainel, listarOrcamentosEmpresa } from "@/lib/dados";
import { formatarData, formatarValor, hojeISO, nomeVeiculo, somarDias } from "@/lib/garagem";
import { formatarQtd, mesAtual, mesValido, somarMes } from "@/lib/gestao";
import { listarFichas, osPorOrigem, resumoGestao } from "@/lib/gestao-dados";

export const metadata: Metadata = { title: "Gestão" };

/** Título de cada parte do painel, com uma linha e um resumo à direita. */
function Secao({ titulo, direita }: { titulo: string; direita?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-1 pt-3">
      <h2 className="shrink-0 text-xs font-bold tracking-wider text-suave uppercase">{titulo}</h2>
      <span className="h-px flex-1 bg-borda" aria-hidden="true" />
      {direita && <div className="shrink-0 text-xs text-suave">{direita}</div>}
    </div>
  );
}

function saudacao(hora: number) {
  return hora < 12 ? "bom dia" : hora < 18 ? "boa tarde" : "boa noite";
}

export default async function GestaoPage({ searchParams }: PageProps<"/gestao">) {
  const [usuario, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const mes = mesValido(sp.mes) ? sp.mes : mesAtual();
  const hoje = hojeISO();
  const mesCalendario = mesAtual();
  const [r, agenda, doMes, aceitos, aResponder, { abertos }, fichas] = await Promise.all([
    resumoGestao(mes),
    agendaEmpresa(),
    agendamentosEntre(`${mesCalendario}-01`, somarDias(`${somarMes(mesCalendario, 1)}-01`, -1)),
    listarOrcamentosEmpresa(["aceito"]),
    contarOrcamentosAResponder(),
    contarPainel(),
    listarFichas(),
  ]);
  const deHoje = agenda.proximos.filter((a) => a.inicio && partesBrasilia(new Date(a.inicio)).dia === hoje);
  const [osDeAgendamentos, osDeOrcamentos] = await Promise.all([
    osPorOrigem("agendamento_id", deHoje.map((a) => a.id)),
    osPorOrigem("orcamento_id", aceitos.map((o) => o.id)),
  ]);
  const orcamentosSemOS = aceitos.filter((o) => !osDeOrcamentos[o.id]);
  const agendadosPorDia: Record<string, number> = {};
  for (const a of doMes) if (a.inicio) {
    const d = partesBrasilia(new Date(a.inicio)).dia;
    agendadosPorDia[d] = (agendadosPorDia[d] ?? 0) + 1;
  }
  const top = [...fichas].filter((f) => f.total_gasto > 0).sort((a, b) => b.total_gasto - a.total_gasto).slice(0, 5);
  const recebidoMes = r.porForma.reduce((t, f) => t + f.valor, 0);
  // Contas a pagar nos próximos 7 dias (e as atrasadas): contas do financeiro e faturas de cartão juntas, por data
  const contasProximas = [
    ...r.cartoes7dias.map((f) => ({
      chave: `cartao-${f.cartao.id}-${f.fatura_mes}`,
      descricao: `💳 Fatura ${f.cartao.nome}`,
      data: f.vencimento,
      valor: f.em_aberto,
      href: `/gestao/financeiro/cartoes/${f.cartao.id}?fatura=${f.fatura_mes}`,
    })),
    ...r.aPagar7dias.map((l) => ({ chave: l.id, descricao: l.descricao, data: l.vencimento ?? l.data, valor: l.valor, href: "/gestao/financeiro" })),
  ].sort((a, b) => a.data.localeCompare(b.data));
  const atencao = r.faturasAbertas.length + contasProximas.length + r.estoqueCritico.length;
  const agora = partesBrasilia(new Date());
  const dataExtenso = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", weekday: "long", timeZone: "America/Sao_Paulo" }).format(new Date());

  return (
    <div className="space-y-4">
      {/* Saudação e atalhos */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Olá {primeiroNome(usuario.nome, usuario.email)}, {saudacao(Number(agora.hora.slice(0, 2)))}!</h1>
          <p className="text-sm text-suave">Hoje é {dataExtenso}.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap [&>*:last-child:nth-child(odd)]:col-span-2">
          {[
            { href: "/gestao/os/nova", rotulo: "Nova OS", icone: "os" as const },
            { href: "/agendamentos/novo", rotulo: "Novo agendamento", icone: "calendario" as const },
            { href: "/orcamentos/novo", rotulo: "Novo orçamento", icone: "orcamento" as const },
            { href: "/gestao/clientes/novo", rotulo: "Novo cliente", icone: "clientes" as const },
            { href: "/gestao/financeiro/novo", rotulo: "Novo lançamento", icone: "financeiro" as const },
          ].map((b) => (
            <Link key={b.href} href={b.href} className="botao-primario gap-1.5 rounded-full px-3 py-2 text-[13px] whitespace-nowrap sm:px-4 sm:text-sm">
              <Icone nome={b.icone} className="h-4 w-4" />
              {b.rotulo}
            </Link>
          ))}
        </div>
      </div>

      {/* Linha 1: calendário · resumo financeiro · recebimentos por forma */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
        <Bloco icone="calendario" titulo="Agenda do mês" direita={<span className="text-xs text-suave">{deHoje.length ? `${deHoje.length} hoje` : "Sem agendamentos hoje"}</span>}>
          <CalendarioMes mes={mesCalendario} hoje={hoje} marcados={agendadosPorDia} />
        </Bloco>
        <Bloco icone="financeiro" titulo="Resumo financeiro" direita={<span className="text-xs"><strong className={r.saldoContas < 0 ? "text-perigo" : "text-sucesso"}>{formatarValor(r.saldoContas)}</strong> <span className="text-suave">de saldo</span></span>}>
          <div className="grid grid-cols-2 gap-2 text-center">
            <Link href="/gestao/financeiro" className="rounded-xl bg-sucesso-claro p-3">
              <p className="text-xs text-suave">Entradas hoje</p>
              <p className="font-titulo text-lg font-bold text-sucesso tabular-nums">▲ {formatarValor(r.entradasHoje)}</p>
            </Link>
            <Link href="/gestao/financeiro" className="rounded-xl bg-perigo-claro p-3">
              <p className="text-xs text-suave">Saídas hoje</p>
              <p className="font-titulo text-lg font-bold text-perigo tabular-nums">▼ {formatarValor(r.saidasHoje)}</p>
            </Link>
            <Link href="/gestao/os?f=receber" className="col-span-2 flex items-center justify-between rounded-xl bg-alerta-claro p-3 text-left">
              <span className="text-xs text-suave">A receber<br />(avulsos, lojistas e faturas)</span>
              <span className="font-titulo text-lg font-bold text-[#b07800] tabular-nums">{formatarValor(r.aReceber.total)}</span>
            </Link>
            <div className="col-span-2 grid grid-cols-2 gap-2 text-left">
              <div className="rounded-xl bg-fundo p-3">
                <p className="text-xs text-suave">Faturado no mês</p>
                <p className="font-semibold tabular-nums">{formatarValor(r.faturadoMes)}</p>
              </div>
              <div className="rounded-xl bg-fundo p-3">
                <p className="text-xs text-suave">Recebido no mês</p>
                <p className="font-semibold tabular-nums">{formatarValor(r.recebidoMes)}</p>
              </div>
            </div>
          </div>
        </Bloco>
        <Bloco icone="cartao" titulo="Recebido por forma" direita={<span className="text-xs"><strong className="text-sucesso">{formatarValor(recebidoMes)}</strong> <span className="text-suave">no mês</span></span>}>
          <GraficoFormas dados={r.porForma} />
        </Bloco>
      </div>

      {/* Linha 2: agenda de hoje · vagas · oportunidades · orçamentos */}
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Bloco icone="calendario" titulo="Agenda de hoje" className="sm:col-span-2 lg:col-span-1" direita={<Link href="/agendamentos" className="text-xs font-semibold text-marca-escura">Ver agenda</Link>}>
          {deHoje.length === 0 && orcamentosSemOS.length === 0 && <p className="text-sm text-suave">Nenhum atendimento confirmado para hoje.</p>}
          <ul className="divide-y divide-borda">
            {deHoje.map((a) => {
              const os = osDeAgendamentos[a.id];
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/agendamentos/${a.id}`} className="min-w-0 text-sm">
                    <p className="font-medium">{a.servico}</p>
                    <p className="truncate text-suave">{formatarQuando(a.inicio, a.fim)} · {a.veiculo?.dono?.nome} · {a.veiculo && `${nomeVeiculo(a.veiculo)} (${a.veiculo.placa})`}</p>
                  </Link>
                  {os ? (
                    <Link href={`/gestao/os/${os.id}`} className="shrink-0 text-sm font-semibold text-marca-escura">OS #{os.numero}</Link>
                  ) : (
                    <Link href={`/gestao/os/nova?agendamento=${a.id}`} className="botao-primario shrink-0 rounded-full px-3 py-1.5 text-sm">Carro chegou: abrir OS</Link>
                  )}
                </li>
              );
            })}
            {orcamentosSemOS.slice(0, 6).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/orcamentos/${o.id}`} className="min-w-0 text-sm">
                  <p className="font-medium">Orçamento #{o.numero} aceito · <Dinheiro valor={o.valor_total ?? 0} /></p>
                  <p className="truncate text-suave">{o.veiculo?.dono?.nome} · {o.veiculo && `${nomeVeiculo(o.veiculo)} (${o.veiculo.placa})`}</p>
                </Link>
                <Link href={`/gestao/os/nova?orcamento=${o.id}`} className="botao-contorno shrink-0 rounded-full px-3 py-1.5 text-sm">Abrir OS</Link>
              </li>
            ))}
          </ul>
        </Bloco>
        <Bloco icone="carro" titulo="Vagas no pátio hoje" direita={<EditarVagas vagas={r.vagas} />}>
          <div className="flex gap-6">
            <Link href="/gestao/os?f=patio"><Contagem n={<>{r.patio.length}<span className="text-base text-suave"> / {r.vagas}</span></>} legenda="vagas ocupadas" cor={r.patio.length >= r.vagas ? "text-perigo" : "text-[#b07800]"} /></Link>
            <Contagem n={r.entreguesHoje} legenda="entregues hoje" cor="text-sucesso" />
          </div>
        </Bloco>
        <Bloco icone="clientes" titulo="Oportunidades">
          <Link href="/painel"><Contagem n={abertos} legenda="apontamentos pendentes nos carros dos clientes" cor={abertos ? "text-marca-escura" : "text-suave"} /></Link>
        </Bloco>
        <Bloco icone="os" titulo="Orçamentos">
          <div className="flex gap-6">
            <Link href="/orcamentos?f=responder"><Contagem n={aResponder} legenda="a responder" cor={aResponder ? "text-[#b07800]" : "text-suave"} /></Link>
            <Contagem n={orcamentosSemOS.length} legenda="aceitos sem OS" cor={orcamentosSemOS.length ? "text-sucesso" : "text-suave"} />
          </div>
        </Bloco>
      </div>

      {/* Precisa de atenção: cada tipo de pendência no seu quadro */}
      <Secao titulo="Precisa de atenção" direita={<span>{atencao ? <strong className="text-perigo">{atencao} {atencao === 1 ? "item" : "itens"}</strong> : <strong className="text-sucesso">Tudo em dia</strong>}</span>} />
      {atencao > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),1fr))] items-start gap-4">
          {r.faturasAbertas.length > 0 && (
            <Bloco icone="faturas" titulo={`Faturas de lojistas · ${r.faturasAbertas.length}`} direita={<Link href="/gestao/faturas" className="text-xs font-semibold text-marca-escura">Ver faturas</Link>}>
              <ul className="divide-y divide-borda">
                                {r.faturasAbertas.slice(0, 6).map((f) => (
                                  <li key={f.id}>
                                    <Link href={`/gestao/faturas/${f.id}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                                      <span className="min-w-0 truncate">#{f.numero} · {f.cliente?.nome} · vence {formatarData(f.vencimento)}</span>
                                      <span className="flex shrink-0 items-center gap-2"><Dinheiro valor={f.total - f.valor_pago} /><SeloFatura f={f} /></span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
            </Bloco>
          )}
          {contasProximas.length > 0 && (
            <Bloco icone="saida" titulo={`Contas a pagar (próximos 7 dias) · ${contasProximas.length}`} direita={<Link href="/gestao/financeiro" className="text-xs font-semibold text-marca-escura">Ver financeiro</Link>}>
              <ul className="divide-y divide-borda">
                {contasProximas.map((c) => (
                  <li key={c.chave}>
                    <Link href={c.href} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        {c.descricao} · <span className={c.data < hoje ? "font-semibold text-perigo" : ""}>{c.data < hoje ? "venceu" : "vence"} {formatarData(c.data)}</span>
                      </span>
                      <Dinheiro valor={c.valor} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Bloco>
          )}
          {r.estoqueCritico.length > 0 && (
            <Bloco icone="estoque" titulo={`Estoque crítico · ${r.estoqueCritico.length}`} direita={<Link href="/gestao/estoque" className="text-xs font-semibold text-marca-escura">Ver estoque</Link>}>
              <ul className="divide-y divide-borda">
                                {r.estoqueCritico.map((p) => (
                                  <li key={p.id}>
                                    <Link href={`/gestao/estoque/${p.id}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                                      <span className="min-w-0 truncate">{p.nome} · {formatarQtd(p.saldo, p.unidade)}</span>
                                      <SeloProduto p={p} />
                                    </Link>
                                  </li>
                                ))}
                              </ul>
            </Bloco>
          )}
        </div>
      )}


      {/* Faturamento por dia */}
      <Bloco icone="financeiro" titulo="Faturamento por dia" direita={<div className="w-64"><NavMes mes={mes} base="/gestao" /></div>}>
        <GraficoDias dias={r.porDia} hoje={hoje} />
        <p className="mt-2 text-xs text-suave">{r.qtdOSMes} OS no mês · faturado <strong className="text-texto">{formatarValor(r.faturadoMes)}</strong></p>
      </Bloco>

      {/* Top 5 clientes */}
      {top.length > 0 && (
        <Bloco icone="clientes" titulo="Top 5 clientes" direita={<Link href="/gestao/clientes" className="text-xs font-semibold text-marca-escura">{fichas.length} clientes</Link>}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {top.map((f) => (
              <Link key={f.id} href={`/gestao/clientes/${f.id}`} className="rounded-xl bg-fundo p-3 text-center transition hover:bg-marca-clara">
                <p className="truncate text-sm font-medium">{f.nome}</p>
                <p className="font-semibold text-marca-escura tabular-nums">{formatarValor(f.total_gasto)}</p>
                <p className="text-xs text-suave">{f.qtd_os} {f.qtd_os === 1 ? "serviço" : "serviços"}</p>
              </Link>
            ))}
          </div>
        </Bloco>
      )}
    </div>
  );
}
