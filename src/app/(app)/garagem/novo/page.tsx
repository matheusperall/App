import type { Metadata } from "next";
import { PaginaFicha } from "@/components/PaginaFicha";
import { Cartao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth";
import { listarVeiculos, obterCliente } from "@/lib/dados";
import { nomeVeiculo } from "@/lib/garagem";
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
  // Veículos que o cliente já tem, para copiar as preferências
  const existentes =
    cliente && "veiculos" in cliente
      ? cliente.veiculos
      : await listarVeiculos(cliente?.perfil_id ?? usuario.id);
  const outros = existentes.map((v) => ({ id: v.id, nome: `${nomeVeiculo(v)} (${v.placa})` }));

  return (
    <PaginaFicha
      voltar={{ href: cliente ? `/gestao/clientes/${cliente.id}` : "/garagem", rotulo: cliente ? cliente.nome || "Cliente" : "Minha garagem" }}
      icone="carro"
      titulo="Novo veículo"
      descricao={cliente ? <>Cadastrando para <strong className="text-texto">{cliente.nome}</strong></> : undefined}
    >
      <Cartao>
        <FormVeiculo outros={outros} donoId={donoId} clienteId={cliente && !cliente.perfil_id ? cliente.id : undefined} />
      </Cartao>
    </PaginaFicha>
  );
}
