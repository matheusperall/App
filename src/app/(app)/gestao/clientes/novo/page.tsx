import type { Metadata } from "next";
import { Voltar } from "@/components/garagem";
import { FormAcao } from "@/components/gestao/FormAcao";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { salvarFicha } from "../actions";
import { CamposFicha } from "../CamposFicha";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NovoClientePage() {
  await exigirAdmin();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Voltar href="/gestao/clientes">Clientes</Voltar>
      <h1 className="text-2xl font-bold">Novo cliente</h1>
      <p className="text-suave">Basta o nome e o telefone. O acesso ao app (garagem digital) pode ser dado agora ou depois, pelo e-mail.</p>
      <Cartao>
        <FormAcao acao={salvarFicha} botao="Cadastrar cliente" pendente="Cadastrando…">
          <CamposFicha />
          <label className="flex items-center gap-2 rounded-xl bg-fundo p-3 text-sm">
            <input type="checkbox" name="convidar" className="h-4 w-4 accent-marca" />
            Enviar agora o convite por e-mail para o cliente acessar o app
          </label>
        </FormAcao>
      </Cartao>
    </div>
  );
}
