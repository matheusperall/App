import type { Metadata } from "next";
import Link from "next/link";
import { Dinheiro, NavMes, SeloFatura, SeloProduto, SeloStatus } from "@/components/gestao";
import { CalendarioMes } from "@/components/gestao/Calendario";
import { GraficoDias } from "@/components/gestao/GraficoDias";
import { GraficoFormas } from "@/components/gestao/GraficoFormas";
import { Bloco, Contagem } from "@/components/gestao/Bloco";
import { EditarVagas } from "@/components/gestao/EditarVagas";
import { Icone } from "@/components/gestao/Icones";
import { exigirAdmin, primeiroNome } from "@/lib/auth";
import { formatarQuando, partesBrasilia } from "@/lib/agenda";
import { agendaEmpresa, contarOrcamentosAResponder, contarPainel, listarOrcamentosEmpresa } from "@/lib/dados";
import { formatarData, formatarValor, hojeISO, nomeVeiculo } from "@/lib/garagem";
import { formatarQtd, mesAtual, mesValido } from "@/lib/gestao";
import { listarFichas, osPorOrigem, resumoGestao } from "@/lib/gestao-dados";

export const metadata: Metadata = { title: "Gestão" };

function saudacao(hora: number) {
  return hora < 12 ? "bom dia" : hora < 18 ? "boa tarde" : "boa noite";
}

export default async function GestaoPage({ searchParams }: PageProps<"/gestao">) {
  const [usuario, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const mes = mesValido(sp.mes) ? sp.mes : mesAtual();
  const hoje = hojeISO();
  const [r, agenda, aceitos, aResponder, { abertos }, fichas] = await Promise.all([
    resumoGestao(mes),
    agendaEmpresa(),
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
  for (const a of agenda.proximos) if (a.inicio) {
    const d = partesBrasilia(new Date(a.inicio)).dia;
    agendadosPorDia[d] = (agendadosPorDia[d] ?? 0) + 1;
  }
  const top = [...fichas].filter((f) => f.total_gasto > 0).sort((a, b) => b.total_gasto - a.total_gasto).slice(0, 5);
  const recebidoMes = r.porForma.reduce((t, f) => t + f.valor, 0);
  const atencao = r.faturasAbertas.length + r.aPagar7dias.length + r.cartoes7dias.length + r.estoqueCritico.length;
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
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {[
            { href: "/gestao/os/nova", rotulo: "Nova OS", icone: "os" as const },
            { href: "/gestao/clientes/novo", rotulo: "Novo cliente", icone: "clientes" as const },
            { href: "/gestao/financeiro/novo", rotulo: "Novo lançamento", icone: "financeiro" as const },
            { href: "/gestao/faturas", rotulo: "Faturas", icone: "faturas" as const },
          ].map((b) => (
            <Link key={b.href} href={b.href} className="botao-primario gap-1.5 rounded-full px-4 py-2 text-sm">
              <Icone nome={b.icone} className="h-4 w-4" />
              {b.rotulo}
            </Link>
          ))}
        </div>
      </div>

      {/* Linha 1: calendário · recebimentos por forma · resumo financeiro */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
        <Bloco icone="calendario" titulo="Agenda do mês" direita={<span className="text-xs text-suave">{deHoje.length ? `${deHoje.length} hoje` : "Sem agendamentos hoje"}</span>}>
          <CalendarioMes mes={mesAtual()} hoje={hoje} marcados={agendadosPorDia} />
        </Bloco>
        <Bloco icone="cartao" titulo="Recebido por forma" direita={<span className="text-xs"><strong className="text-sucesso">{formatarValor(recebidoMes)}</strong> <span className="text-suave">no mês</span></span>}>
          <GraficoFormas dados={r.porForma} />
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
      </div>

      {/* Linha 2: contadores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Bloco icone="os" titulo="Orçamentos">
          <div className="flex gap-6">
            <Link href="/orcamentos?f=responder"><Contagem n={aResponder} legenda="a responder" cor={aResponder ? "text-[#b07800]" : "text-suave"} /></Link>
            <Contagem n={orcamentosSemOS.length} legenda="aceitos sem OS" cor={orcamentosSemOS.length ? "text-sucesso" : "text-suave"} />
          </div>
        </Bloco>
        <Bloco icone="carro" titulo="Vagas no pátio hoje" direita={<EditarVagas vagas={r.vagas} />}>
          <div className="flex gap-6">
            <Contagem n={<>{r.patio.length}<span className="text-base text-suave"> / {r.vagas}</span></>} legenda="vagas ocupadas" cor={r.patio.length >= r.vagas ? "text-perigo" : "text-[#b07800]"} />
            <Contagem n={r.entreguesHoje} legenda="entregues hoje" cor="text-sucesso" />
          </div>
        </Bloco>
        <Bloco icone="clientes" titulo="Oportunidades">
          <Link href="/painel"><Contagem n={abertos} legenda="apontamentos pendentes nos carros dos clientes" cor={abertos ? "text-marca-escura" : "text-suave"} /></Link>
        </Bloco>
        <Bloco icone="faturas" titulo="Faturas e contas">
          <div className="flex gap-6">
            <Link href="/gestao/faturas"><Contagem n={r.faturasAbertas.length} legenda="faturas em aberto" cor={r.faturasAbertas.length ? "text-[#b07800]" : "text-suave"} /></Link>
            <Link href="/gestao/financeiro"><Contagem n={r.aPagar7dias.length + r.cartoes7dias.length} legenda="contas e faturas de cartão a pagar em 7 dias" cor={r.aPagar7dias.length + r.cartoes7dias.length ? "text-perigo" : "text-suave"} /></Link>
          </div>
        </Bloco>
      </div>

      {/* Linha 3: pátio · agenda de hoje */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bloco icone="carro" titulo={`No pátio · ${r.patio.length} de ${r.vagas}`} direita={<div className="flex items-center gap-2"><Link href="/gestao/os?f=patio" className="text-xs font-semibold text-marca-escura">Ver todos</Link><EditarVagas vagas={r.vagas} /></div>}>
          <div className="mb-3 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: Math.max(r.vagas, r.patio.length) }, (_, i) => (
              <div key={i} className={`h-2.5 flex-1 rounded-full ${i < r.patio.length ? (i >= r.vagas ? "bg-perigo" : "bg-marca") : "bg-borda"}`} />
            ))}
          </div>
          {r.patio.length === 0 ? (
            <p className="text-sm text-suave">Pátio livre.</p>
          ) : (
            <ul className="divide-y divide-borda">
              {r.patio.map((o) => (
                <li key={o.id}>
                  <Link href={`/gestao/os/${o.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-marca-escura">
                    <span className="min-w-0 truncate"><span className="font-mono font-semibold">{o.placa ?? "—"}</span> · {o.veiculo_nome} · {o.cliente?.nome}</span>
                    <SeloStatus status={o.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        <Bloco icone="calendario" titulo="Agenda de hoje" direita={<Link href="/agendamentos" className="text-xs font-semibold text-marca-escura">Ver agenda</Link>}>
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
      </div>

      {/* Linha 4: atenção · faturamento por dia */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bloco icone="faturas" titulo={`Precisa de atenção${atencao ? ` (${atencao})` : ""}`}>
          {atencao === 0 && <p className="text-sm text-suave">Tudo em dia.</p>}
          <div className="space-y-3">
            {r.faturasAbertas.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold tracking-wide text-suave uppercase">Faturas em aberto</h3>
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
              </div>
            )}
            {r.cartoes7dias.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold tracking-wide text-suave uppercase">Faturas de cartão</h3>
                <ul className="divide-y divide-borda">
                  {r.cartoes7dias.map((f) => (
                    <li key={`${f.cartao.id}-${f.fatura_mes}`}>
                      <Link href={`/gestao/financeiro/cartoes/${f.cartao.id}?fatura=${f.fatura_mes}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate">💳 {f.cartao.nome} · <span className={f.vencimento < hoje ? "font-semibold text-perigo" : ""}>vence {formatarData(f.vencimento)}</span></span>
                        <Dinheiro valor={f.em_aberto} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {r.aPagar7dias.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold tracking-wide text-suave uppercase">Contas a pagar em até 7 dias</h3>
                <ul className="divide-y divide-borda">
                  {r.aPagar7dias.slice(0, 6).map((l) => (
                    <li key={l.id}>
                      <Link href="/gestao/financeiro" className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate">{l.descricao} · <span className={(l.vencimento ?? l.data) < hoje ? "font-semibold text-perigo" : ""}>{formatarData(l.vencimento ?? l.data)}</span></span>
                        <Dinheiro valor={l.valor} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {r.estoqueCritico.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold tracking-wide text-suave uppercase">Estoque crítico</h3>
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
              </div>
            )}
          </div>
        </Bloco>
        <Bloco icone="financeiro" titulo="Faturamento por dia" direita={<div className="w-64"><NavMes mes={mes} base="/gestao" /></div>}>
          <GraficoDias dias={r.porDia} hoje={hoje} />
          <p className="mt-2 text-xs text-suave">{r.qtdOSMes} OS no mês · faturado <strong className="text-texto">{formatarValor(r.faturadoMes)}</strong></p>
        </Bloco>
      </div>

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
