import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Voltar } from "@/components/garagem";
import { Dinheiro, SeloFatura } from "@/components/gestao";
import { CopiarWhatsApp } from "@/components/gestao/Copiar";
import { FormAcao } from "@/components/gestao/FormAcao";
import { Aviso, Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { formatarData, hojeISO } from "@/lib/garagem";
import { arred, rotuloForma, extratoFaturaWhatsApp, faturaEmAberto, linkWhatsApp, type ItemFatura } from "@/lib/gestao";
import { listarContas, obterFatura } from "@/lib/gestao-dados";
import { cancelarFatura } from "../actions";
import { FormPagarFatura } from "./FormPagarFatura";

export const metadata: Metadata = { title: "Fatura" };

export default async function FaturaPage({ params, searchParams }: PageProps<"/gestao/faturas/[faturaId]">) {
  const [{ faturaId }, sp] = await Promise.all([params, searchParams, exigirAdmin()]);
  const [dados, contas] = await Promise.all([obterFatura(faturaId), listarContas()]);
  if (!dados) notFound();
  const { fatura: f, itens, pagamentos } = dados;
  const saldo = arred(f.total - f.valor_pago);
  const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));

  // Extrato por veículo
  const porVeiculo = new Map<string, ItemFatura[]>();
  for (const i of itens) {
    const chave = i.placa || i.veiculo || "Sem placa";
    porVeiculo.set(chave, [...(porVeiculo.get(chave) ?? []), i]);
  }
  const extrato = extratoFaturaWhatsApp(f, itens);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Voltar href="/gestao/faturas">Faturas</Voltar>
      {sp.nova && <Aviso tipo="sucesso">Fatura gerada! Copie o extrato e envie ao lojista.</Aviso>}

      <Cartao className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-suave">Fatura #{f.numero} · emitida em {formatarData(f.emissao)}</p>
            <h1 className="text-2xl font-bold">
              <Link href={`/gestao/clientes/${f.cliente_id}`} className="hover:underline">{f.cliente?.nome}</Link>
            </h1>
            <p className="text-sm text-suave">Período {formatarData(f.periodo_inicio)} a {formatarData(f.periodo_fim)} · vence {formatarData(f.vencimento)}</p>
          </div>
          <SeloFatura f={f} />
        </div>
        <dl className="grid grid-cols-3 gap-2 rounded-xl bg-fundo p-3 text-center text-sm">
          <div><dt className="text-xs text-suave">Total</dt><dd className="font-semibold"><Dinheiro valor={f.total} /></dd></div>
          <div><dt className="text-xs text-suave">Pago</dt><dd className="font-semibold"><Dinheiro valor={f.valor_pago} /></dd></div>
          <div><dt className="text-xs text-suave">Saldo</dt><dd className="font-semibold"><Dinheiro valor={saldo} /></dd></div>
        </dl>
        {f.observacoes && <p className="text-sm">{f.observacoes}</p>}
      </Cartao>

      <Cartao className="p-0">
        <h2 className="px-5 pt-5 font-semibold">Extrato por veículo</h2>
        {[...porVeiculo].map(([veiculo, lista]) => (
          <div key={veiculo} className="mt-3 border-t border-borda">
            <div className="flex justify-between bg-fundo px-5 py-2 text-sm font-semibold">
              <span>{veiculo} {lista[0].placa && lista[0].veiculo}</span>
              <Dinheiro valor={arred(lista.reduce((t, i) => t + i.valor, 0))} />
            </div>
            <ul className="divide-y divide-borda text-sm">
              {lista.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 px-5 py-2.5">
                  <span className="min-w-0">
                    {formatarData(i.data)} · {i.os_id ? <Link href={`/gestao/os/${i.os_id}`} className="hover:underline">{i.servicos}</Link> : i.servicos}
                  </span>
                  <Dinheiro valor={i.valor} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Cartao>

      {pagamentos.length > 0 && (
        <Cartao className="p-0">
          <h2 className="px-5 pt-5 font-semibold">Pagamentos</h2>
          <ul className="mt-2 divide-y divide-borda text-sm">
            {pagamentos.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 px-5 py-2.5">
                <span>{formatarData(p.data)} · {p.forma ? rotuloForma(p.forma, p.parcelas) : "—"} · {nomeConta.get(p.conta_id ?? "") ?? "—"}{p.taxa_valor ? <> · taxa <Dinheiro valor={p.taxa_valor} /></> : null}</span>
                <Dinheiro valor={p.valor} />
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      {faturaEmAberto(f) && (
        <Cartao className="space-y-3">
          <h2 className="font-semibold">Registrar pagamento</h2>
          <FormPagarFatura faturaId={f.id} saldo={saldo} contas={contas.filter((c) => c.ativa)} hoje={hojeISO()} />
        </Cartao>
      )}

      <Cartao className="space-y-3">
        <h2 className="font-semibold">Enviar ao lojista</h2>
        <CopiarWhatsApp texto={extrato} rotulo="Copiar extrato" link={f.cliente?.telefone ? linkWhatsApp(f.cliente.telefone, extrato) : undefined} />
      </Cartao>

      {faturaEmAberto(f) && f.valor_pago === 0 && (
        <FormAcao
          acao={cancelarFatura}
          campos={{ id: f.id }}
          botao="Cancelar fatura"
          pendente="Cancelando…"
          classeBotao="botao w-full border border-perigo/30 text-perigo hover:bg-perigo-claro"
          confirmar="Cancelar esta fatura? As OS voltam para a lista de “a faturar”."
        />
      )}
    </div>
  );
}
