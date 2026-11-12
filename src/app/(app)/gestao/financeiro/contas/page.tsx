import type { Metadata } from "next";
import { Cabecalho } from "@/components/gestao/Cabecalho";
import { FormAcao } from "@/components/gestao/FormAcao";
import { Icone, type NomeIcone } from "@/components/gestao/Icones";
import { Campo, Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { formatarValor } from "@/lib/garagem";
import { FORMAS_PAGAMENTO, TIPOS_CONTA, arred, type Conta } from "@/lib/gestao";
import { contasAPagar, contasAReceberAvulsas, listarContas, obterConfig } from "@/lib/gestao-dados";
import { abasFinanceiro } from "../abas";
import { salvarConfig } from "../actions";
import { FormConta } from "../FormConta";

export const metadata: Metadata = { title: "Contas" };

const ESTILO: Record<Conta["tipo"], { borda: string; icone: NomeIcone; fundo: string }> = {
  banco: { borda: "border-l-[#e3a008]", icone: "conta", fundo: "bg-[#fff7e0] text-[#8a5a00]" },
  caixa: { borda: "border-l-sucesso", icone: "caixa", fundo: "bg-sucesso-claro text-sucesso" },
  digital: { borda: "border-l-[#6d5bd0]", icone: "cartao", fundo: "bg-[#f1efff] text-[#4b3aa8]" },
  outro: { borda: "border-l-[#3a7be0]", icone: "cartao", fundo: "bg-[#ecf3ff] text-[#2357a8]" },
};

export default async function ContasPage({ searchParams }: PageProps<"/gestao/financeiro/contas">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const [contas, aPagar, aReceber, config] = await Promise.all([listarContas(), contasAPagar(), contasAReceberAvulsas(), obterConfig()]);
  const previsto = (c: Conta) =>
    arred(c.saldo + aReceber.filter((l) => l.conta_id === c.id).reduce((t, l) => t + l.valor, 0) - aPagar.filter((l) => l.conta_id === c.id).reduce((t, l) => t + l.valor, 0));
  const total = arred(contas.filter((c) => c.ativa).reduce((t, c) => t + c.saldo, 0));

  return (
    <div className="space-y-4">
      <Cabecalho icone="financeiro" titulo="Financeiro" abas={abasFinanceiro("contas")} acao={{ href: "/gestao/financeiro/contas?nova=1#nova", rotulo: "Nova conta" }} />

      <section className="space-y-4 rounded-2xl border border-borda bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold">Estas são as suas contas</h2>
            <p className="text-sm text-suave">Saldo de cada conta e o previsto, contando o que ainda falta pagar e receber.</p>
          </div>
          <p className="text-sm">Total: <strong className={`tabular-nums ${total < 0 ? "text-perigo" : "text-sucesso"}`}>{formatarValor(total)}</strong></p>
        </div>

        {sp.nova && (
          <div id="nova" className="scroll-mt-20">
            <FormConta padrao={config} />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {contas.map((c) => {
            const e = ESTILO[c.tipo];
            const p = previsto(c);
            return (
              <article key={c.id} className={`space-y-3 rounded-2xl border border-l-4 border-borda ${e.borda} bg-white p-4 shadow-[0_1px_3px_rgba(11,18,32,0.06)] ${c.ativa ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${e.fundo}`}><Icone nome={e.icone} className="h-6 w-6" /></span>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{c.nome}</h3>
                      <p className="text-xs text-suave">{TIPOS_CONTA[c.tipo]}</p>
                    </div>
                  </div>
                  {!c.ativa && <span className="rounded-full bg-fundo px-2.5 py-0.5 text-xs font-semibold text-suave">Inativa</span>}
                </div>
                <div>
                  <p className="text-xs font-medium tracking-wide text-suave uppercase">Saldo atual</p>
                  <p className={`font-titulo text-2xl font-bold tabular-nums ${c.saldo < 0 ? "text-perigo" : "text-sucesso"}`}>{formatarValor(c.saldo)}</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-borda pt-2 text-xs">
                  <span className="text-suave">Previsto: <strong className={`tabular-nums ${p < 0 ? "text-perigo" : "text-texto"}`}>{formatarValor(p)}</strong></span>
                  <span className="text-suave">{c.formas.map((f) => FORMAS_PAGAMENTO[f].replace("Cartão de ", "")).join(" · ") || "sem formas"}</span>
                </div>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-marca-escura">Editar conta, formas e taxas</summary>
                  <div className="mt-2"><FormConta conta={c} padrao={config} /></div>
                </details>
              </article>
            );
          })}
        </div>
      </section>

      <Cartao className="space-y-3">
        <h2 className="font-semibold">Configurações da gestão</h2>
        <FormAcao acao={salvarConfig} botao="Salvar" classeBotao="botao-contorno w-full sm:w-auto">
          <Campo rotulo="Vagas no pátio" dica="Quantos carros cabem ao mesmo tempo.">
            <input name="vagas_patio" defaultValue={config.vagas_patio} inputMode="numeric" className="campo block sm:max-w-40" />
          </Campo>
        </FormAcao>
      </Cartao>
    </div>
  );
}
