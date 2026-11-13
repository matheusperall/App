import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Placa, Voltar } from "@/components/garagem";
import { Dinheiro, SeloStatus } from "@/components/gestao";
import { MensagensWhatsApp } from "@/components/MensagensWhatsApp";
import { mensagensOS } from "@/lib/mensagens";
import { FormAcao } from "@/components/gestao/FormAcao";
import { Aviso, Cartao } from "@/components/ui";
import { AtencaoPreferencias } from "@/components/AtencaoPreferencias";
import { obterVeiculo, preferenciasDosVeiculos } from "@/lib/dados";
import { exigirAdmin } from "@/lib/auth";
import { formatarData, formatarValor, formatarDataHora, formatarKm, hojeISO } from "@/lib/garagem";
import { STATUS_OS, arred, faltaReceber, rotuloForma } from "@/lib/gestao";
import { consumoDaOS, listarContas, obterModelosMensagens, obterOS, pagamentosDaOS } from "@/lib/gestao-dados";
import { avancarStatus, cancelarOS, voltarStatus } from "../actions";
import { FormReceber } from "./FormReceber";

export const metadata: Metadata = { title: "Ordem de serviço" };

export default async function OSPage({ params, searchParams }: PageProps<"/gestao/os/[osId]">) {
  const [{ osId }, sp] = await Promise.all([params, searchParams, exigirAdmin()]);
  const os = await obterOS(osId);
  if (!os) notFound();
  const [consumo, contas, pagamentos, preferencias] = await Promise.all([
    consumoDaOS(os.id),
    listarContas(),
    pagamentosDaOS(os.id),
    os.veiculo_id ? preferenciasDosVeiculos([os.veiculo_id]) : Promise.resolve({} as Record<string, string[]>),
  ]);
  // Dados do carro e modelos para as mensagens de WhatsApp
  const [carro, modelos] = await Promise.all([os.veiculo_id ? obterVeiculo(os.veiculo_id) : Promise.resolve(null), obterModelosMensagens()]);
  const falta = faltaReceber(os);
  const nomeConta = (id: string | null) => contas.find((c) => c.id === id)?.nome;
  const s = STATUS_OS[os.status];
  const editavel = (os.status === "aberta" || os.status === "em_andamento") && !os.pago && !os.fatura_id;
  const cancelavel = os.status !== "entregue" && os.status !== "cancelada" && !os.pago && !(os.valor_pago ?? 0) && !os.fatura_id;
  const margem = arred(os.total - os.custo_produtos - os.taxa_valor);

  return (
    <div className="space-y-4">
      <Voltar href="/gestao/os">Ordens de serviço</Voltar>
      {sp.nova && <Aviso tipo="sucesso">OS aberta! Avance as etapas conforme o serviço andar.</Aviso>}

      <header className="rounded-2xl border border-borda bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-suave">OS #{os.numero} · {formatarData(os.data)}</p>
            <h1 className="text-2xl font-bold">
              <Link href={`/gestao/clientes/${os.cliente_id}`} className="hover:underline">{os.cliente?.nome ?? "Cliente"}</Link>
            </h1>
            {os.cliente?.lojista && <p className="text-sm font-semibold text-marca-escura">Lojista · paga por fatura</p>}
          </div>
          <div className="flex items-center gap-2">
            {editavel && (
              <Link href={`/gestao/os/${os.id}/editar`} className="botao-contorno rounded-full px-4 py-2 text-sm">
                ✏️ Editar
              </Link>
            )}
            <SeloStatus status={os.status} />
          </div>
        </div>
        <p className="mt-2 text-xs text-suave">
          Aberta em {formatarDataHora(os.criado_em)}
          {os.pronta_em && ` · pronta em ${formatarDataHora(os.pronta_em)}`}
          {os.entregue_em && ` · entregue em ${formatarDataHora(os.entregue_em)}`}
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Esquerda: veículo, serviços e custos */}
        <div className="min-w-0 space-y-4">
      <Cartao className="space-y-3">
        <h2 className="font-semibold">Veículo</h2>
        {(os.placa || os.veiculo_nome) && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-fundo px-4 py-3">
            <div className="min-w-0 text-sm">
              {os.veiculo_id ? (
                <Link href={`/garagem/${os.veiculo_id}`} className="font-medium hover:underline">{os.veiculo_nome}</Link>
              ) : (
                <span className="font-medium">{os.veiculo_nome}</span>
              )}
              {os.km != null && <span className="block text-suave">{formatarKm(os.km)}</span>}
            </div>
            {os.placa && <Placa placa={os.placa} tamanho="sm" />}
          </div>
        )}
        {/* Preferências do cliente só importam enquanto o carro está na loja */}
        {os.veiculo_id && os.status !== "entregue" && os.status !== "cancelada" && <AtencaoPreferencias preferencias={preferencias[os.veiculo_id]} />}
        {os.observacoes && <p className="text-sm whitespace-pre-line">{os.observacoes}</p>}
      </Cartao>
      <Cartao className="p-0">
        <h2 className="px-5 pt-4 font-semibold">Serviços</h2>
        <ul className="divide-y divide-borda">
          {os.itens.map((i, n) => (
            <li key={i.id ?? n} className="flex justify-between gap-3 px-5 py-3 text-sm">
              <span>{i.nome}</span>
              <Dinheiro valor={i.preco} />
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-borda px-5 py-4 text-sm">
          {os.desconto > 0 && (
            <>
              <div className="flex justify-between"><dt className="text-suave">Subtotal</dt><dd><Dinheiro valor={os.subtotal} /></dd></div>
              <div className="flex justify-between"><dt className="text-suave">Desconto</dt><dd className="tabular-nums">−<Dinheiro valor={os.desconto} /></dd></div>
            </>
          )}
          <div className="flex justify-between text-lg font-bold"><dt>Total</dt><dd><Dinheiro valor={os.total} /></dd></div>
        </dl>
      </Cartao>
      {/* Custos e margem */}
      {os.estoque_baixado && (
        <Cartao className="space-y-2">
          <h2 className="font-semibold">Custo e margem</h2>
          {consumo.length > 0 ? (
            <ul className="text-sm text-suave">{consumo.map((c, i) => <li key={i} className="flex justify-between"><span>{c.texto}</span><Dinheiro valor={c.custo} /></li>)}</ul>
          ) : (
            <p className="text-sm text-suave">Nenhum produto cadastrado no consumo destes serviços.</p>
          )}
          <dl className="space-y-1 rounded-xl bg-fundo p-3 text-sm">
            <div className="flex justify-between"><dt className="text-suave">Custo de produtos</dt><dd><Dinheiro valor={os.custo_produtos} /></dd></div>
            {os.taxa_valor > 0 && <div className="flex justify-between"><dt className="text-suave">Taxa de recebimento</dt><dd><Dinheiro valor={os.taxa_valor} /></dd></div>}
            <div className="flex justify-between font-semibold">
              <dt>Margem</dt>
              <dd><Dinheiro valor={margem} sinal /> {os.total > 0 && <span className="text-xs font-normal text-suave">({Math.round((margem / os.total) * 100)}%)</span>}</dd>
            </div>
          </dl>
        </Cartao>
      )}
        </div>

        {/* Direita: próxima etapa, pagamento e envio */}
        <div className="min-w-0 space-y-4">
      {/* Etapas: avançar e, se precisar, voltar uma */}
      {(s.proximo || s.anterior) && (
        <Cartao className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">{s.proximo ? "Próxima etapa" : "Etapa"}</h2>
            <SeloStatus status={os.status} />
          </div>
          {s.proximo === "pronta" && <p className="text-sm text-suave">Ao marcar como pronta, os produtos usados nos serviços saem do estoque automaticamente.</p>}
          {s.proximo === "entregue" && <p className="text-sm text-suave">Ao entregar, o serviço vai para o histórico do veículo{os.cliente?.perfil_id ? " e o cliente recebe um aviso no app" : ""}.</p>}
          {s.proximo && s.acao && <FormAcao acao={avancarStatus} campos={{ id: os.id, para: s.proximo }} botao={s.acao} pendente="Atualizando…" />}
          {s.anterior && (
            <FormAcao
              acao={voltarStatus}
              campos={{ id: os.id, para: s.anterior }}
              botao={`↩ Voltar para “${STATUS_OS[s.anterior].rotulo}”`}
              pendente="Voltando…"
              classeBotao="botao-contorno w-full text-sm"
              confirmar={
                os.status === "pronta"
                  ? `Voltar a OS para “${STATUS_OS[s.anterior].rotulo}”? Os produtos usados voltam para o estoque.`
                  : os.status === "entregue"
                    ? `Voltar a OS para “${STATUS_OS[s.anterior].rotulo}”? O serviço sai do histórico do veículo.`
                    : `Voltar a OS para “${STATUS_OS[s.anterior].rotulo}”?`
              }
            />
          )}
        </Cartao>
      )}
      {/* Pagamento */}
      {os.status !== "cancelada" && (
        <Cartao className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Pagamento</h2>
            {!os.cliente?.lojista && (os.valor_pago ?? 0) > 0 && (
              <span className="text-sm text-suave">
                Pago <strong className="text-sucesso">{formatarValor(os.valor_pago ?? 0)}</strong>
                {falta > 0 && <> · falta <strong className="text-[#b07800]">{formatarValor(falta)}</strong></>}
              </span>
            )}
          </div>
          {pagamentos.length > 0 && (
            <ul className="divide-y divide-borda rounded-xl border border-borda text-sm">
              {pagamentos.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="font-medium">{i + 1}º pagamento</span>
                    <span className="block text-xs text-suave">
                      {formatarData(p.data)} · {rotuloForma(p.forma, p.parcelas)}{nomeConta(p.conta_id) && ` · ${nomeConta(p.conta_id)}`}
                      {p.taxa_valor > 0 && ` · taxa ${formatarValor(p.taxa_valor)}`}
                    </span>
                  </span>
                  <span className="font-semibold text-sucesso tabular-nums">{formatarValor(p.valor)}</span>
                </li>
              ))}
            </ul>
          )}
          {os.pago && pagamentos.length > 0 ? null : os.pago ? (
            <Aviso tipo="sucesso">
              Pago em {formatarData(os.pago_em)}{os.forma_pagamento && ` · ${rotuloForma(os.forma_pagamento, os.parcelas)}`}{os.conta_id && contas.find((c) => c.id === os.conta_id) && ` · ${contas.find((c) => c.id === os.conta_id)!.nome}`}
              {os.taxa_valor > 0 && <> · taxa de <Dinheiro valor={os.taxa_valor} /></>}
            </Aviso>
          ) : os.cliente?.lojista ? (
            <p className="text-sm text-suave">
              Cliente lojista: não recebe por OS. {os.fatura_id ? (
                <Link href={`/gestao/faturas/${os.fatura_id}`} className="font-semibold text-marca-escura">Ver a fatura</Link>
              ) : (
                <>Quando estiver pronta, ela aparece em <Link href="/gestao/faturas" className="font-semibold text-marca-escura">Faturas</Link> para entrar na fatura do mês.</>
              )}
            </p>
          ) : contas.length === 0 ? (
            <p className="text-sm text-suave">Cadastre uma conta em <Link href="/gestao/financeiro" className="font-semibold text-marca-escura">Financeiro</Link> para receber.</p>
          ) : (
            <FormReceber osId={os.id} falta={falta} contas={contas.filter((c) => c.ativa)} hoje={hojeISO()} />
          )}
        </Cartao>
      )}
      <MensagensWhatsApp
        mensagens={mensagensOS(os, pagamentos, { nome: os.cliente?.nome, marca: carro?.marca, modelo: carro?.modelo, ano: carro?.ano, cor: carro?.cor, placa: carro?.placa ?? os.placa }, modelos)}
        telefone={os.cliente?.telefone}
      />
      {cancelavel && (
        <FormAcao
          acao={cancelarOS}
          campos={{ id: os.id }}
          botao="Cancelar esta OS"
          pendente="Cancelando…"
          classeBotao="botao w-full border border-perigo/30 text-perigo hover:bg-perigo-claro"
          confirmar="Cancelar esta OS? Os produtos que saíram do estoque voltam."
        />
      )}
        </div>
      </div>
    </div>
  );
}
