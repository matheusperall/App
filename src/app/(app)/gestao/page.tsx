import type { Metadata } from "next";
import Link from "next/link";
import { Dinheiro, Indicador, NavMes, SeloFatura, SeloProduto, SeloStatus, Titulo } from "@/components/gestao";
import { GraficoDias } from "@/components/gestao/GraficoDias";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { formatarQuando, partesBrasilia } from "@/lib/agenda";
import { agendaEmpresa, contarPainel, listarOrcamentosEmpresa } from "@/lib/dados";
import { formatarData, hojeISO, nomeVeiculo } from "@/lib/garagem";
import { formatarQtd, mesAtual, mesValido } from "@/lib/gestao";
import { osPorOrigem, resumoGestao } from "@/lib/gestao-dados";

export const metadata: Metadata = { title: "Gestão" };

export default async function GestaoPage({ searchParams }: PageProps<"/gestao">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const mes = mesValido(sp.mes) ? sp.mes : mesAtual();
  const hoje = hojeISO();
  const [r, agenda, aceitos, { abertos }] = await Promise.all([resumoGestao(mes), agendaEmpresa(), listarOrcamentosEmpresa(["aceito"]), contarPainel()]);
  const deHoje = agenda.proximos.filter((a) => a.inicio && partesBrasilia(new Date(a.inicio)).dia === hoje);
  const [osDeAgendamentos, osDeOrcamentos] = await Promise.all([
    osPorOrigem("agendamento_id", deHoje.map((a) => a.id)),
    osPorOrigem("orcamento_id", aceitos.map((o) => o.id)),
  ]);
  const orcamentosSemOS = aceitos.filter((o) => !osDeOrcamentos[o.id]);
  const vagasLivres = Math.max(0, r.vagas - r.patio.length);
  const atencao = r.faturasAbertas.length + r.aPagar7dias.length + r.estoqueCritico.length;

  return (
    <div className="space-y-5">
      <Titulo pre="Gestão da loja" titulo="Painel">
        <Link href="/gestao/os/nova" className="botao-primario px-4 py-2.5 text-sm">+ Nova OS</Link>
      </Titulo>

      <NavMes mes={mes} base="/gestao" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Faturado no mês" valor={<Dinheiro valor={r.faturadoMes} />} detalhe="OS prontas e entregues" href={`/gestao/os?f=todas&mes=${mes}`} />
        <Indicador rotulo="Recebido no mês" valor={<Dinheiro valor={r.recebidoMes} />} href={`/gestao/financeiro?mes=${mes}`} />
        <Indicador
          rotulo="A receber"
          valor={<Dinheiro valor={r.aReceber.total} />}
          destaque={r.aReceber.total > 0}
          href="/gestao/os?f=receber"
          detalhe={
            <>
              Avulsos <Dinheiro valor={r.aReceber.avulsos} /> · Lojistas sem fatura <Dinheiro valor={r.aReceber.lojistasSemFatura} /> · Faturas abertas{" "}
              <Dinheiro valor={r.aReceber.faturasAbertas} />
            </>
          }
        />
        <Indicador rotulo="Saldo em contas" valor={<Dinheiro valor={r.saldoContas} />} href="/gestao/financeiro" />
      </div>

      {/* Pátio */}
      <Cartao className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">🚗 Pátio · {r.patio.length} de {r.vagas} vagas</h2>
          <span className={`text-sm font-semibold ${vagasLivres === 0 ? "text-perigo" : "text-sucesso"}`}>{vagasLivres === 0 ? "Lotado" : `${vagasLivres} livre${vagasLivres > 1 ? "s" : ""}`}</span>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: Math.max(r.vagas, r.patio.length) }, (_, i) => (
            <div key={i} className={`h-2.5 flex-1 rounded-full ${i < r.patio.length ? (i >= r.vagas ? "bg-perigo" : "bg-marca") : "bg-borda"}`} />
          ))}
        </div>
        {r.patio.length > 0 && (
          <ul className="divide-y divide-borda">
            {r.patio.map((o) => (
              <li key={o.id}>
                <Link href={`/gestao/os/${o.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-marca-escura">
                  <span className="min-w-0 truncate">
                    <span className="font-mono font-semibold">{o.placa ?? "—"}</span> · {o.veiculo_nome} · {o.cliente?.nome}
                  </span>
                  <SeloStatus status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      {/* Agenda do dia e orçamentos aceitos */}
      <Cartao className="p-0">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="font-semibold">📅 Agenda de hoje</h2>
          <Link href="/agendamentos" className="text-sm font-semibold text-marca-escura hover:underline">Ver agenda</Link>
        </div>
        {deHoje.length === 0 ? (
          <p className="px-5 pt-2 pb-5 text-sm text-suave">Nenhum atendimento confirmado para hoje.</p>
        ) : (
          <ul className="mt-2 divide-y divide-borda">
            {deHoje.map((a) => {
              const os = osDeAgendamentos[a.id];
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/agendamentos/${a.id}`} className="min-w-0 text-sm">
                    <p className="font-medium">{a.servico}</p>
                    <p className="truncate text-suave">{formatarQuando(a.inicio, a.fim)} · {a.veiculo?.dono?.nome} · {a.veiculo && `${nomeVeiculo(a.veiculo)} (${a.veiculo.placa})`}</p>
                  </Link>
                  {os ? (
                    <Link href={`/gestao/os/${os.id}`} className="shrink-0 text-sm font-semibold text-marca-escura">OS #{os.numero}</Link>
                  ) : (
                    <Link href={`/gestao/os/nova?agendamento=${a.id}`} className="botao-primario shrink-0 px-3 py-2 text-sm">Carro chegou: abrir OS</Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {orcamentosSemOS.length > 0 && (
          <>
            <h3 className="border-t border-borda px-5 pt-4 text-sm font-semibold">Orçamentos aceitos sem OS</h3>
            <ul className="mt-1 divide-y divide-borda">
              {orcamentosSemOS.slice(0, 10).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/orcamentos/${o.id}`} className="min-w-0 text-sm">
                    <p className="font-medium">Orçamento #{o.numero} · <Dinheiro valor={o.valor_total ?? 0} /></p>
                    <p className="truncate text-suave">{o.veiculo?.dono?.nome} · {o.veiculo && `${nomeVeiculo(o.veiculo)} (${o.veiculo.placa})`}</p>
                  </Link>
                  <Link href={`/gestao/os/nova?orcamento=${o.id}`} className="botao-contorno shrink-0 px-3 py-2 text-sm">Abrir OS</Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="h-2" />
      </Cartao>

      {/* Precisa de atenção */}
      <Cartao className="space-y-3">
        <h2 className="font-semibold">⚠️ Precisa de atenção {atencao > 0 && <span className="text-suave">({atencao})</span>}</h2>
        {atencao === 0 && <p className="text-sm text-suave">Tudo em dia.</p>}
        {r.faturasAbertas.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-suave">Faturas em aberto</h3>
            <ul className="divide-y divide-borda">
              {r.faturasAbertas.slice(0, 8).map((f) => (
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
        {r.aPagar7dias.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-suave">Contas a pagar em até 7 dias</h3>
            <ul className="divide-y divide-borda">
              {r.aPagar7dias.slice(0, 8).map((l) => (
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
            <h3 className="text-sm font-semibold text-suave">Estoque crítico</h3>
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
      </Cartao>

      <Cartao className="space-y-3">
        <h2 className="font-semibold">Faturamento por dia</h2>
        <GraficoDias dias={r.porDia} hoje={hoje} />
      </Cartao>

      {abertos > 0 && (
        <Link href="/painel" className="block rounded-2xl border border-borda bg-white p-4 text-sm transition hover:border-marca/50">
          💡 <strong>{abertos}</strong> {abertos === 1 ? "apontamento pendente" : "apontamentos pendentes"} nos carros dos clientes — oportunidades de venda. <span className="font-semibold text-marca-escura">Ver no painel</span>
        </Link>
      )}
    </div>
  );
}
