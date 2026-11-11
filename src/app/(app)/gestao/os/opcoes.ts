import "server-only";
import { nomeVeiculo } from "@/lib/garagem";
import { listarCatalogo, listarFichas } from "@/lib/gestao-dados";
import type { OpcaoCliente, OpcaoServico } from "./FormOS";

/** Listas usadas pelo formulário de OS (clientes com veículos e serviços ativos do catálogo). */
export async function opcoesFormOS(): Promise<{ clientes: OpcaoCliente[]; catalogo: OpcaoServico[] }> {
  const [fichas, catalogo] = await Promise.all([listarFichas(), listarCatalogo()]);
  return {
    clientes: fichas.map((f) => ({
      id: f.id,
      nome: f.nome,
      telefone: f.telefone,
      lojista: f.lojista,
      veiculos: f.veiculos.map((v) => ({ id: v.id, placa: v.placa, nome: nomeVeiculo(v) })),
    })),
    catalogo: catalogo.filter((s) => s.ativo).map(({ id, nome, preco, categoria }) => ({ id, nome, preco, categoria })),
  };
}
