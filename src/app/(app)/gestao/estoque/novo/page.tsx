import type { Metadata } from "next";
import { Voltar } from "@/components/garagem";
import { FormAcao } from "@/components/gestao/FormAcao";
import { Campo, Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { salvarProduto } from "../actions";
import { CamposProduto } from "../CamposProduto";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NovoProdutoPage() {
  await exigirAdmin();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Voltar href="/gestao/estoque">Estoque</Voltar>
      <h1 className="text-2xl font-bold">Novo produto</h1>
      <Cartao>
        <FormAcao acao={salvarProduto} botao="Cadastrar produto" pendente="Cadastrando…">
          <CamposProduto />
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-fundo p-3">
            <Campo rotulo="Quanto tem hoje" dica="Na unidade escolhida (ex.: 5000 ml)">
              <input name="saldo_inicial" inputMode="decimal" className="campo" placeholder="0" />
            </Campo>
            <Campo rotulo="Quanto custou (R$)" dica="Valor total dessa quantidade">
              <input name="valor_inicial" inputMode="decimal" className="campo" placeholder="0,00" />
            </Campo>
          </div>
        </FormAcao>
      </Cartao>
    </div>
  );
}
