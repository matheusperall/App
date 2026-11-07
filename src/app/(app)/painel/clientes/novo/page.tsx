import type { Metadata } from "next";
import { Voltar } from "@/components/garagem";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { FormCliente } from "./FormCliente";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NovoClientePage() {
  await exigirAdmin();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Voltar href="/painel/clientes">Clientes</Voltar>
      <h1 className="text-2xl font-bold">Novo cliente</h1>
      <p className="text-suave">
        O cliente recebe um e-mail de convite para criar a senha e acessar a garagem digital. Você já pode
        cadastrar os veículos dele em seguida.
      </p>
      <Cartao>
        <FormCliente />
      </Cartao>
    </div>
  );
}
