import { NextResponse, type NextRequest } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { consultarFipe } from "@/lib/fipe-servidor";

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


export async function GET(_: NextRequest, ctx: RouteContext<"/api/fipe/[...caminho]">) {
  // Só para quem entrou no app (evita que outros usem o app para gastar o limite da FIPE)
  if (!(await getUsuarioAtual())) return NextResponse.json({ erro: "Entre no app para consultar" }, { status: 401 });
  const { caminho } = await ctx.params;
  const alvo = caminho.join("/");
  if (!PERMITIDO.test(alvo)) return NextResponse.json({ erro: "Consulta inválida" }, { status: 400 });

  try {
    const dados = await consultarFipe(alvo);
    return NextResponse.json(dados, { headers: { "cache-control": "private, max-age=3600" } });
  } catch (e) {
    console.error("[fipe]", alvo, (e as Error).message);
    return NextResponse.json({ erro: "Tabela FIPE indisponível no momento" }, { status: 502 });
  }
}
