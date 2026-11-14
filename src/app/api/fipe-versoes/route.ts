import { NextResponse, type NextRequest } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { connection } from "next/server";
import { lerAnoFipe, modeloBase, type AnoComVersoes, type ItemFipe } from "@/lib/fipe";
import { consultarFipe, emParalelo } from "@/lib/fipe-servidor";

/**
 * Anos e versões de um modelo básico.
 * GET /api/fipe-versoes?tipo=carros&marca=59&modelo=polo
 * Consulta os anos de cada versão do modelo (com cache de 1 dia) e organiza por ano.
 */
export async function GET(request: NextRequest) {
  await connection();
  // Só para quem entrou no app (evita que outros usem o app para gastar o limite da FIPE)
  if (!(await getUsuarioAtual())) return NextResponse.json({ erro: "Entre no app para consultar" }, { status: 401 });
  const p = request.nextUrl.searchParams;
  const tipo = p.get("tipo") ?? "";
  const marca = p.get("marca") ?? "";
  const modelo = (p.get("modelo") ?? "").toLowerCase();
  if (!/^(carros|motos|caminhoes)$/.test(tipo) || !/^\d{1,6}$/.test(marca) || !modelo || modelo.length > 60) {
    return NextResponse.json({ erro: "Consulta inválida" }, { status: 400 });
  }

  try {
    const { modelos } = await consultarFipe<{ modelos: ItemFipe[] }>(`${tipo}/marcas/${marca}/modelos`);
    const versoes = modelos
      .map((m) => ({ codigo: String(m.codigo), nome: m.nome }))
      .filter((m) => modeloBase(m.nome).chave === modelo)
      .slice(0, 150);
    if (versoes.length === 0) return NextResponse.json({ anos: [] });

    const anosPorVersao = await emParalelo(versoes, 6, (v) =>
      consultarFipe<ItemFipe[]>(`${tipo}/marcas/${marca}/modelos/${v.codigo}/anos`),
    );

    const anoAtual = new Date().getFullYear();
    const mapa = new Map<string, AnoComVersoes>();
    versoes.forEach((v, i) => {
      for (const a of anosPorVersao[i] ?? []) {
        const { ano, zeroKm, combustivel } = lerAnoFipe(a.nome, anoAtual);
        if (!ano) continue;
        const chave = zeroKm ? "0km" : String(ano);
        const item = mapa.get(chave) ?? { ano, zeroKm, versoes: [] };
        item.versoes.push({ modeloCod: v.codigo, nome: v.nome, anoCod: String(a.codigo), combustivel });
        mapa.set(chave, item);
      }
    });

    const anos = [...mapa.values()]
      .map((a) => ({ ...a, versoes: a.versoes.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")) }))
      .sort((a, b) => Number(b.zeroKm) - Number(a.zeroKm) || b.ano - a.ano);
    const incompleto = anosPorVersao.some((r) => r === null);
    return NextResponse.json({ anos, incompleto }, { headers: { "cache-control": "private, max-age=3600" } });
  } catch (e) {
    console.error("[fipe-versoes]", (e as Error).message);
    return NextResponse.json({ erro: "Tabela FIPE indisponível no momento" }, { status: 502 });
  }
}
