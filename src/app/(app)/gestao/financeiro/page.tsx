import type { Metadata } from "next";
import Link from "next/link";
import { Dinheiro, Indicador, NavMes, Titulo, Vazio } from "@/components/gestao";
import { FormAcao } from "@/components/gestao/FormAcao";
import { Campo, Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { formatarData, hojeISO } from "@/lib/garagem";
import { TIPOS_CONTA, arred, mesAtual, mesValido, type Lancamento } from "@/lib/gestao";
import { contasAPagar, contasAReceberAvulsas, lancamentosDoMes, listarCategorias, listarContas, obterConfig } from "@/lib/gestao-dados";
import { excluirLancamento, marcarPago, salvarConfig } from "./actions";
import { FormConta } from "./FormConta";
import { FormLancamento } from "./FormLancamento";

export const metadata: Metadata = { title: "Financeiro" };

export default async function FinanceiroPage({ searchParams }: PageProps<"/gestao/financeiro">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const mes = mesValido(sp.mes) ? sp.mes : mesAtual();
  const hoje = hojeISO();
  const [contas, categorias, lancamentos, aPagar, aReceber, config] = await Promise.all([
    listarContas(),
    listarCategorias(),
    lancamentosDoMes(mes),
    contasAPagar(),
    contasAReceberAvulsas(),
    obterConfig(),
  ]);
  const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));
  const nomeCat = new Map(categorias.map((c) => [c.id, c.nome]));
  const doMes = lancamentos.filter((l) => l.pago && (l.pago_em ?? l.data).startsWith(mes));
  const entradas = arred(doMes.filter((l) => l.tipo === "entrada").reduce((t, l) => t + l.valor, 0));
  const saidas = arred(doMes.filter((l) => l.tipo === "saida").reduce((t, l) => t + l.valor, 0));
  const ativas = contas.filter((c) => c.ativa);
  const lista = lancamentos.filter((l) => l.data.startsWith(mes) || (l.pago_em ?? "").startsWith(mes));

  return (
    <div className="space-y-5">
      <Titulo pre="Gestão" titulo="Financeiro">
        <Link href={`/gestao/financeiro/resultado?mes=${mes}`} className="botao-escuro px-4 py-2.5 text-sm">📊 Resultado do mês (DRE)</Link>
      </Titulo>

      {/* Contas */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {ativas.map((c) => (
            <Indicador key={c.id} rotulo={`${c.nome} · ${TIPOS_CONTA[c.tipo]}`} valor={<Dinheiro valor={c.saldo} />} />
          ))}
          <Indicador rotulo="Saldo total" valor={<Dinheiro valor={arred(ativas.reduce((t, c) => t + c.saldo, 0))} />} destaque />
        </div>
        <details className="rounded-2xl border border-borda bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-marca-escura">Gerenciar contas, formas de recebimento e taxas</summary>
          <div className="mt-3 space-y-4">
            {contas.map((c) => <FormConta key={c.id} conta={c} padrao={config} />)}
            <FormConta padrao={config} />
          </div>
        </details>
      </section>

      {/* Contas a pagar */}
      <Cartao className="p-0">
        <h2 className="px-5 pt-5 font-semibold">Contas a pagar</h2>
        {aPagar.length === 0 ? (
          <Vazio>Nenhuma conta a pagar. 🎉</Vazio>
        ) : (
          <ul className="mt-2 divide-y divide-borda">
            {aPagar.map((l) => <LinhaAberta key={l.id} l={l} hoje={hoje} contas={ativas} categoria={nomeCat.get(l.categoria_id ?? "")} />)}
          </ul>
        )}
      </Cartao>

      {aReceber.length > 0 && (
        <Cartao className="p-0">
          <h2 className="px-5 pt-5 font-semibold">Outros valores a receber</h2>
          <ul className="mt-2 divide-y divide-borda">
            {aReceber.map((l) => <LinhaAberta key={l.id} l={l} hoje={hoje} contas={ativas} categoria={nomeCat.get(l.categoria_id ?? "")} />)}
          </ul>
        </Cartao>
      )}

      {/* Lançamentos do mês */}
      <section className="space-y-3">
        <NavMes mes={mes} base="/gestao/financeiro" />
        <div className="grid grid-cols-3 gap-3">
          <Indicador compacto rotulo="Entrou" valor={<Dinheiro valor={entradas} />} />
          <Indicador compacto rotulo="Saiu" valor={<Dinheiro valor={saidas} />} />
          <Indicador compacto rotulo="Saldo do mês" valor={<Dinheiro valor={arred(entradas - saidas)} sinal />} />
        </div>
        <Cartao className="p-0">
          <h2 className="px-5 pt-5 font-semibold">Lançamentos</h2>
          {lista.length === 0 ? (
            <Vazio>Nenhum lançamento neste mês.</Vazio>
          ) : (
            <ul className="mt-2 divide-y divide-borda">
              {lista.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">
                      {l.os_id ? <Link href={`/gestao/os/${l.os_id}`} className="hover:underline">{l.descricao}</Link> : l.fatura_id ? <Link href={`/gestao/faturas/${l.fatura_id}`} className="hover:underline">{l.descricao}</Link> : l.descricao}
                    </p>
                    <p className="text-xs text-suave">
                      {formatarData(l.pago_em ?? l.data)} · {nomeCat.get(l.categoria_id ?? "") ?? "Sem categoria"} · {nomeConta.get(l.conta_id ?? "") ?? "—"}
                      {!l.pago && " · em aberto"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Dinheiro valor={l.tipo === "saida" ? -l.valor : l.valor} sinal className="font-semibold" />
                    {!l.os_id && !l.fatura_id && (
                      <FormAcao acao={excluirLancamento} campos={{ id: l.id }} botao="Apagar" pendente="…" classeBotao="text-xs text-suave underline" className="" confirmar="Apagar este lançamento?" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </section>

      <Cartao className="space-y-3">
        <h2 className="font-semibold">Novo lançamento</h2>
        <FormLancamento categorias={categorias} contas={ativas} hoje={hoje} />
      </Cartao>

      <Cartao className="space-y-3">
        <h2 className="font-semibold">Configurações da gestão</h2>
        <FormAcao acao={salvarConfig} botao="Salvar" classeBotao="botao-contorno w-full">
          <Campo rotulo="Vagas no pátio" dica="Quantos carros cabem ao mesmo tempo. As taxas de recebimento ficam em cada conta (Gerenciar contas).">
            <input name="vagas_patio" defaultValue={config.vagas_patio} inputMode="numeric" className="campo" />
          </Campo>
        </FormAcao>
      </Cartao>
    </div>
  );
}

function LinhaAberta({ l, hoje, contas, categoria }: { l: Lancamento; hoje: string; contas: { id: string; nome: string }[]; categoria?: string }) {
  const venc = l.vencimento ?? l.data;
  const vencida = venc < hoje;
  return (
    <li className="space-y-2 px-5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="font-medium">{l.descricao}</p>
          <p className={`text-xs ${vencida ? "font-semibold text-perigo" : "text-suave"}`}>
            {vencida ? "Vencida em " : "Vence em "}{formatarData(venc)}{categoria && ` · ${categoria}`}
          </p>
        </div>
        <Dinheiro valor={l.valor} className="shrink-0 font-semibold" />
      </div>
      <FormAcao acao={marcarPago} campos={{ id: l.id }} botao={l.tipo === "saida" ? "Marcar como pago" : "Marcar como recebido"} pendente="…" classeBotao="botao-contorno px-3 py-2 text-sm" className="flex flex-wrap items-center gap-2">
        <select name="conta_id" defaultValue={l.conta_id ?? contas[0]?.id} className="campo w-auto px-2 py-2 text-sm" aria-label="Conta">
          {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <input type="date" name="data" defaultValue={hoje} className="campo w-auto px-2 py-2 text-sm" aria-label="Data do pagamento" />
      </FormAcao>
    </li>
  );
}
