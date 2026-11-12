import type { Metadata } from "next";
import { Voltar } from "@/components/garagem";
import { Cartao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth";
import { obterCliente } from "@/lib/dados";
import { obterFicha } from "@/lib/gestao-dados";
import { FormVeiculo } from "../FormVeiculo";

export const metadata: Metadata = { title: "Novo veículo" };

export default async function NovoVeiculoPage({ searchParams }: PageProps<"/garagem/novo">) {
  const [usuario, params] = await Promise.all([exigirUsuario(), searchParams]);

  // A empresa pode cadastrar o veículo de um cliente: /garagem/novo?cliente=<id>
  const clienteId = usuario.papel === "admin" && typeof params.cliente === "string" ? params.cliente : null;
  // Aceita o id da ficha da loja ou o id da conta do app
  // (sem a gestão instalada no banco, usa a conta do app como antes)
  const cliente =
    (clienteId ? await obterFicha(clienteId) : null) ??
    (clienteId ? await obterCliente(clienteId).then((c) => (c ? { id: c.id, nome: c.nome, perfil_id: c.id } : null)) : null);
  const donoId = cliente ? (cliente.perfil_id ?? `c-${cliente.id}`) : usuario.id;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Voltar href={cliente ? `/gestao/clientes/${cliente.id}` : "/garagem"}>
        {cliente ? cliente.nome || "Cliente" : "Minha garagem"}
      </Voltar>
      <h1 className="text-2xl font-bold">Novo veículo</h1>
      {cliente && <p className="text-suave">Cadastrando para <strong className="text-texto">{cliente.nome}</strong></p>}
      <Cartao>
        <FormVeiculo donoId={donoId} clienteId={cliente && !cliente.perfil_id ? cliente.id : undefined} />
      </Cartao>
    </div>
  );
}
