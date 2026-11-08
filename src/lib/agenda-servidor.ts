import "server-only";
import { DIAS_A_FRENTE, horariosLivres, type Intervalo } from "@/lib/agenda";
import { isSupabaseConfigured } from "@/lib/env";
import { googleConfigurado, ocupadosGoogle } from "@/lib/google-agenda";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Para a lavagem: bloqueios da Google Agenda da empresa (eventos "ocupado")
 * e as lavagens já confirmadas no app (que contam para o limite simultâneo).
 */
export async function intervalosOcupados(
  de: Date,
  ate: Date,
): Promise<{ bloqueios: Intervalo[]; lavagens: Intervalo[]; aviso?: string }> {
  const bloqueios: Intervalo[] = [];
  const lavagens: Intervalo[] = [];
  let aviso: string | undefined;

  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from("agendamentos")
      .select("inicio, fim")
      .eq("situacao", "confirmado")
      .eq("tipo", "lavagem")
      .gte("fim", de.toISOString())
      .lte("inicio", ate.toISOString());
    for (const a of data ?? []) if (a.inicio && a.fim) lavagens.push({ inicio: new Date(a.inicio), fim: new Date(a.fim) });
  }

  if (googleConfigurado()) {
    try {
      // Os eventos criados pelo app entram como "livre", então aqui só vêm os seus bloqueios
      bloqueios.push(...(await ocupadosGoogle(de, ate)));
    } catch (e) {
      console.error("[agenda]", (e as Error).message);
      aviso = "Não conseguimos consultar a agenda agora; os horários podem não estar atualizados.";
    }
  }
  return { bloqueios, lavagens, aviso };
}

export async function horariosDisponiveis(agora = new Date()) {
  if (!isSupabaseConfigured) return { dias: horariosLivres([], agora), aviso: undefined };
  const ate = new Date(agora.getTime() + (DIAS_A_FRENTE + 1) * 86400_000);
  const { bloqueios, lavagens, aviso } = await intervalosOcupados(agora, ate);
  return { dias: horariosLivres(bloqueios, agora, lavagens), aviso };
}
