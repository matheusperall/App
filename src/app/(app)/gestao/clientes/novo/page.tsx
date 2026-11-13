import type { Metadata } from "next";
import { PaginaFicha } from "@/components/PaginaFicha";
import { FormAcao } from "@/components/gestao/FormAcao";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { salvarFicha } from "../actions";
import { CamposFicha } from "../CamposFicha";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NovoClientePage() {
  await exigirAdmin();
  return (
    <PaginaFicha
      voltar={{ href: "/gestao/clientes", rotulo: "Clientes" }}
      icone="clientes"
      titulo="Novo cliente"
      descricao="Basta o nome e o telefone. O acesso ao app (garagem digital) pode ser dado agora ou depois, pelo e-mail."
    >
      <Cartao>
        <FormAcao acao={salvarFicha} botao="Cadastrar cliente" pendente="Cadastrando…" className="ficha">
          <CamposFicha />
          <label className="flex items-center gap-2 rounded-xl bg-fundo p-3 text-sm">
            <input type="checkbox" name="convidar" className="h-4 w-4 accent-marca" />
            Enviar agora o convite por e-mail para o cliente acessar o app
          </label>
        </FormAcao>
      </Cartao>
    </PaginaFicha>
  );
}
