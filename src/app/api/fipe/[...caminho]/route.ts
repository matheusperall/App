import { cacheLife } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Repassa consultas para a API pública da tabela FIPE, com cache de 1 dia
 * (a tabela muda uma vez por mês; o cache evita estourar o limite gratuito).
 *
 * Caminhos aceitos (e só estes):
 *   /api/fipe/carros/marcas
 *   /api/fipe/carros/marcas/{marca}/modelos
 *   /api/fipe/carros/marcas/{marca}/modelos/{modelo}/anos
 *   /api/fipe/carros/marcas/{marca}/modelos/{modelo}/anos/{ano}
 */
const PERMITIDO = /^(carros|motos|caminhoes)\/marcas(\/\d{1,6}\/modelos(\/\d{1,8}\/anos(\/\d{4,5}-\d{1,2})?)?)?$/;

const BASE = (process.env.FIPE_API_URL || "https://parallelum.com.br/fipe/api/v1").replace(/\/+$/, "");

async function consultar(caminho: string) {
  "use cache";
  cacheLife("days");
  const r = await fetch(`${BASE}/${caminho}`, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`FIPE respondeu ${r.status}`);
  return (await r.json()) as unknown;
}

export async function GET(_: NextRequest, ctx: RouteContext<"/api/fipe/[...caminho]">) {
  const { caminho } = await ctx.params;
  const alvo = caminho.join("/");
  if (!PERMITIDO.test(alvo)) return NextResponse.json({ erro: "Consulta inválida" }, { status: 400 });

  try {
    const dados = await consultar(alvo);
    return NextResponse.json(dados, { headers: { "cache-control": "public, max-age=3600" } });
  } catch (e) {
    console.error("[fipe]", alvo, (e as Error).message);
    return NextResponse.json({ erro: "Tabela FIPE indisponível no momento" }, { status: 502 });
  }
}
