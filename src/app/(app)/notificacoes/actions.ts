"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { notificar, pushConfigurado } from "@/lib/notificar";
import { getSiteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Inscricao = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Guarda a inscrição de notificações deste aparelho. */
export async function salvarInscricao(inscricao: Inscricao, aparelho: string) {
  if (!isSupabaseConfigured) return { ok: false, erro: "Modo demonstração." };
  const usuario = await exigirUsuario();
  if (!inscricao?.endpoint?.startsWith("https://") || !inscricao.keys?.p256dh || !inscricao.keys?.auth)
    return { ok: false, erro: "Inscrição inválida." };

  // O mesmo aparelho pode ter sido usado por outra conta: troca o dono da inscrição.
  const admin = createAdminClient();
  if (!admin) return { ok: false, erro: "Servidor sem a chave SUPABASE_SERVICE_ROLE_KEY." };
  await admin.from("push_inscricoes").delete().eq("endpoint", inscricao.endpoint);
  const { error } = await admin.from("push_inscricoes").insert({
    usuario_id: usuario.id,
    endpoint: inscricao.endpoint,
    p256dh: inscricao.keys.p256dh,
    auth: inscricao.keys.auth,
    aparelho: aparelho.slice(0, 120),
  });
  return error ? { ok: false, erro: "Não foi possível salvar." } : { ok: true };
}

export async function removerInscricao(endpoint: string) {
  if (!isSupabaseConfigured) return;
  await exigirUsuario();
  const supabase = await createClient();
  await supabase.from("push_inscricoes").delete().eq("endpoint", endpoint);
}

/** Envia um aviso de teste para o próprio usuário. */
export async function enviarTeste() {
  if (!isSupabaseConfigured) return { ok: false, erro: "Modo demonstração." };
  const usuario = await exigirUsuario();
  if (!pushConfigurado()) return { ok: false, erro: "As chaves de notificação ainda não foram configuradas na Vercel." };
  await notificar(
    [usuario.id],
    { titulo: "Tudo certo! 🎉", corpo: "As notificações da Sempre Zero estão funcionando neste aparelho.", link: "/notificacoes" },
    await getSiteUrl(),
  );
  revalidatePath("/notificacoes");
  return { ok: true };
}

export async function marcarTodasComoLidas() {
  if (!isSupabaseConfigured) return;
  const usuario = await exigirUsuario();
  const supabase = await createClient();
  await supabase
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("usuario_id", usuario.id)
    .is("lida_em", null);
  revalidatePath("/", "layout");
}
