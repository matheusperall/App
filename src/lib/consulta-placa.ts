import "server-only";
import { limparValor } from "@/lib/env";
import { normalizarPlaca, placaValida } from "@/lib/garagem";

/**
 * Consulta de dados do veículo pela placa — PONTO PREPARADO para um serviço pago no futuro.
 *
 * Hoje nenhum fornecedor está ligado: `placaConfigurada()` devolve false e a tela
 * mostra só a escolha pela tabela FIPE. Para ligar um fornecedor:
 *   1. Contrate a API e cadastre na Vercel PLACA_API_URL e PLACA_API_TOKEN.
 *   2. Implemente a chamada em `consultarFornecedor` abaixo, convertendo a resposta para `DadosPlaca`.
 * O formulário de OS já chama /api/placa e preenche marca, modelo e ano com o resultado.
 */
export type DadosPlaca = {
  placa: string;
  marca: string;
  modelo: string;
  ano: number | null;
  cor?: string | null;
  combustivel?: string | null;
  codigoFipe?: string | null;
};

export const placaConfigurada = () => Boolean(limparValor(process.env.PLACA_API_URL) && limparValor(process.env.PLACA_API_TOKEN));

export async function consultarPlaca(placa: string): Promise<DadosPlaca | null> {
  const p = normalizarPlaca(placa);
  if (!placaValida(p) || !placaConfigurada()) return null;
  try {
    return await consultarFornecedor(p);
  } catch (e) {
    console.error("[placa]", (e as Error).message);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function consultarFornecedor(placa: string): Promise<DadosPlaca | null> {
  // Fornecedor ainda não escolhido. Exemplo do que fazer aqui:
  // const r = await fetch(`${process.env.PLACA_API_URL}/${placa}`, { headers: { Authorization: `Bearer ${process.env.PLACA_API_TOKEN}` } });
  // const j = await r.json();
  // return { placa, marca: j.marca, modelo: j.modelo, ano: Number(j.ano) || null };
  return null;
}
