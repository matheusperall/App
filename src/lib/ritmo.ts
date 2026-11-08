import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularRitmo, hojeISO, type LeituraKm } from "@/lib/garagem";

/**
 * Registra uma leitura do hodômetro e recalcula o ritmo de uso do veículo.
 * Funciona com o cliente do usuário (regras de acesso do banco) ou com o do servidor.
 * Nunca lança erro: se o banco ainda não tiver a tabela (0008), apenas ignora.
 */
export async function registrarLeitura(
  supabase: SupabaseClient,
  veiculoId: string,
  km: number,
  origem: LeituraKm["origem"],
  data = hojeISO(),
) {
  try {
    const { error } = await supabase.from("leituras_km").insert({ veiculo_id: veiculoId, km, data, origem });
    if (error) return;
    await recalcularRitmo(supabase, veiculoId);
  } catch (e) {
    console.error("[ritmo]", e);
  }
}

export async function recalcularRitmo(supabase: SupabaseClient, veiculoId: string) {
  const { data, error } = await supabase.from("leituras_km").select("km, data, origem").eq("veiculo_id", veiculoId);
  if (error) return null;
  const ritmo = calcularRitmo((data ?? []) as LeituraKm[]);
  await supabase
    .from("veiculos")
    .update({ km_por_dia: ritmo?.kmPorDia ?? null, ritmo_calculado_em: new Date().toISOString() })
    .eq("id", veiculoId);
  return ritmo;
}
