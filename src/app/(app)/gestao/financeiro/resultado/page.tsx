import type { Metadata } from "next";
import { Dinheiro, NavMes } from "@/components/gestao";
import { Cabecalho } from "@/components/gestao/Cabecalho";
import { abasFinanceiro } from "../abas";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { mesAtual, mesValido } from "@/lib/gestao";
import { dreDoMes } from "@/lib/gestao-dados";

export const metadata: Metadata = { title: "Resultado do mês" };

function Linha({ rotulo, valor, menos = false, forte = false, detalhe }: { rotulo: string; valor: number; menos?: boolean; forte?: boolean; detalhe?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 px-5 py-3 ${forte ? "bg-fundo font-semibold" : ""}`}>
      <dt>
        {menos && <span className="text-suave">(−) </span>}
        {rotulo}
        {detalhe && <span className="block text-xs font-normal text-suave">{detalhe}</span>}
      </dt>
      <dd className="shrink-0">{menos ? <Dinheiro valor={-valor} /> : <Dinheiro valor={valor} sinal={forte} />}</dd>
    </div>
  );
}

export default async function ResultadoPage({ searchParams }: PageProps<"/gestao/financeiro/resultado">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const mes = mesValido(sp.mes) ? sp.mes : mesAtual();
  const d = await dreDoMes(mes);
  const pct = (v: number) => (d.receita > 0 ? ` · ${Math.round((v / d.receita) * 100)}% da receita` : "");

  return (
    <div className="space-y-4">
      <Cabecalho icone="financeiro" titulo="Financeiro" abas={abasFinanceiro("resultado", mes)} acao={{ href: "/gestao/financeiro/novo", rotulo: "Adicionar" }} />
      <div className="space-y-4">
      <h2 className="text-xl font-bold">Resultado do mês (DRE)</h2>
      <p className="text-sm text-suave">
        Por competência: conta o serviço no mês em que foi feito (OS pronta ou entregue), mesmo que o dinheiro entre depois.
      </p>
      <NavMes mes={mes} base="/gestao/financeiro/resultado" />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
        <Cartao className="p-0">
          <dl className="divide-y divide-borda text-sm">
            <Linha rotulo="Receita das OS" valor={d.receita} detalhe={`${d.qtdOS} ${d.qtdOS === 1 ? "OS concluída" : "OS concluídas"}`} />
            <Linha rotulo="Taxas de cartão" valor={d.taxas} menos />
            <Linha rotulo="Produtos consumidos" valor={d.produtos} menos detalhe="Custo médio dos produtos que saíram do estoque nas OS" />
            <Linha rotulo="Margem bruta" valor={d.margemBruta} forte detalhe={pct(d.margemBruta).replace(" · ", "") || undefined} />
            {d.despesas.length === 0 ? (
              <div className="px-5 py-3 text-suave">Nenhuma despesa lançada neste mês.</div>
            ) : (
              d.despesas.map((x) => <Linha key={x.categoria} rotulo={x.categoria} valor={x.valor} menos />)
            )}
            {d.outrasReceitas > 0 && <Linha rotulo="Outras receitas" valor={d.outrasReceitas} />}
            <Linha rotulo="Resultado" valor={d.resultado} forte detalhe={pct(d.resultado).replace(" · ", "") || undefined} />
          </dl>
        </Cartao>
        </div>
        <div className="min-w-0 space-y-4">
        {d.comprasProdutos > 0 && (
          <p className="text-sm text-suave">
            Compras de produtos no mês: <Dinheiro valor={d.comprasProdutos} />. Elas não entram como despesa porque viram estoque — o custo aparece na linha “Produtos consumidos” quando o produto é usado.
          </p>
        )}
        </div>
      </div>

      </div>
    </div>
  );
}
