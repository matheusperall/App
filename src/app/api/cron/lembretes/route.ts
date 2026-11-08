import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { limparValor } from "@/lib/env";
import { processarLembretes } from "@/lib/lembretes";
import { getSiteUrl } from "@/lib/site";

/**
 * Chamado todo dia pela Vercel (vercel.json > crons).
 * A Vercel envia "Authorization: Bearer <CRON_SECRET>"; sem a senha certa, nada acontece.
 */
export async function GET(request: NextRequest) {
  await connection();
  const segredo = limparValor(process.env.CRON_SECRET);
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  try {
    const resultado = await processarLembretes(await getSiteUrl());
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    console.error("[cron lembretes]", e);
    return NextResponse.json({ ok: false, erro: (e as Error).message }, { status: 500 });
  }
}
