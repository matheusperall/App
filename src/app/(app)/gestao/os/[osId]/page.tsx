import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Placa, Voltar } from "@/components/garagem";
import { Dinheiro, SeloStatus } from "@/components/gestao";
import { CopiarWhatsApp } from "@/components/gestao/Copiar";
import { FormAcao } from "@/components/gestao/FormAcao";
import { Aviso, Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { formatarData, formatarDataHora, formatarKm, hojeISO } from "@/lib/garagem";
import { STATUS_OS, rotuloForma, arred, linkWhatsApp, resumoOSWhatsApp } from "@/lib/gestao";
import { consumoDaOS, listarContas, obterOS } from "@/lib/gestao-dados";
import { avancarStatus, cancelarOS } from "../actions";
import { FormReceber } from "./FormReceber";

export const metadata: Metadata = { title: "Ordem de serviço" };

export default async function OSPage({ params, searchParams }: PageProps<"/gestao/os/[osId]">) {
  const [{ osId }, sp] = await Promise.all([params, searchParams, exigirAdmin()]);
  const os = await obterOS(osId);
  if (!os) notFound();
  const [consumo, contas] = await Promise.all([consumoDaOS(os.id), listarContas()]);
  const s = STATUS_OS[os.status];
  const editavel = (os.status === "aberta" || os.status === "em_andamento") && !os.pago && !os.fatura_id;
  const cancelavel = os.status !== "entregue" && os.status !== "cancelada" && !os.pago && !os.fatura_id;
  const margem = arred(os.total - os.custo_produtos - os.taxa_valor);
  const resumo = resumoOSWhatsApp(os);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Voltar href="/gestao/os">Ordens de serviço</Voltar>
      {sp.nova && <Aviso tipo="sucesso">OS aberta! Avance as etapas conforme o serviço andar.</Aviso>}

      <Cartao className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-suave">OS #{os.numero} · {formatarData(os.data)}</p>
            <h1 className="text-2xl font-bold">
              <Link href={`/gestao/clientes/${os.cliente_id}`} className="hover:underline">{os.cliente?.nome ?? "Cliente"}</Link>
            </h1>
            {os.cliente?.lojista && <p className="text-sm font-semibold text-marca-escura">Lojista · paga por fatura</p>}
          </div>
          <SeloStatus status={os.status} />
        </div>
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
        {os.observacoes && <p className="text-sm whitespace-pre-line">{os.observacoes}</p>}
      </Cartao>

      <Cartao className="p-0">
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

      {/* Próxima etapa */}
      {s.proximo && (
        <Cartao className="space-y-2">
          {s.proximo === "pronta" && <p className="text-sm text-suave">Ao marcar como pronta, os produtos usados nos serviços saem do estoque automaticamente.</p>}
          {s.proximo === "entregue" && <p className="text-sm text-suave">Ao entregar, o serviço vai para o histórico do veículo{os.cliente?.perfil_id ? " e o cliente recebe um aviso no app" : ""}.</p>}
          <FormAcao acao={avancarStatus} campos={{ id: os.id, para: s.proximo }} botao={s.acao} pendente="Atualizando…" />
          {editavel && <Link href={`/gestao/os/${os.id}/editar`} className="botao-contorno w-full text-sm">✏️ Editar serviços, desconto ou km</Link>}
        </Cartao>
      )}

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

      {/* Pagamento */}
      {os.status !== "cancelada" && (
        <Cartao className="space-y-3">
          <h2 className="font-semibold">Pagamento</h2>
          {os.pago ? (
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
            <FormReceber osId={os.id} total={os.total} contas={contas.filter((c) => c.ativa)} hoje={hojeISO()} />
          )}
        </Cartao>
      )}

      <Cartao className="space-y-3">
        <h2 className="font-semibold">Enviar ao cliente</h2>
        <CopiarWhatsApp texto={resumo} rotulo="Copiar resumo da OS" link={os.cliente?.telefone ? linkWhatsApp(os.cliente.telefone, resumo) : undefined} />
      </Cartao>

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
      <p className="text-center text-xs text-suave">
        Aberta em {formatarDataHora(os.criado_em)}
        {os.pronta_em && ` · pronta em ${formatarDataHora(os.pronta_em)}`}
        {os.entregue_em && ` · entregue em ${formatarDataHora(os.entregue_em)}`}
      </p>
    </div>
  );
}
