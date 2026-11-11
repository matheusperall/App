import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { consultarPlaca, placaConfigurada } from "@/lib/consulta-placa";

/** GET /api/placa?placa=ABC1D23 — só para a empresa. Hoje responde "não configurado". */
export async function GET(request: NextRequest) {
  await connection();
  const usuario = await getUsuarioAtual();
  if (usuario?.papel !== "admin") return NextResponse.json({ erro: "Não autorizado" }, { status: 403 });
  if (!placaConfigurada()) return NextResponse.json({ erro: "Consulta por placa ainda não contratada" }, { status: 501 });
  const dados = await consultarPlaca(request.nextUrl.searchParams.get("placa") ?? "");
  if (!dados) return NextResponse.json({ erro: "Placa não encontrada" }, { status: 404 });
  return NextResponse.json(dados);
}
