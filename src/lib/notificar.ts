import "server-only";
import * as webpush from "web-push";
import { limparValor } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type Aviso = { titulo: string; corpo?: string; link?: string };

export const vapidPublica = () => limparValor(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
const vapidPrivada = () => limparValor(process.env.VAPID_PRIVATE_KEY);
export const pushConfigurado = () => Boolean(vapidPublica() && vapidPrivada());

const resendChave = () => limparValor(process.env.RESEND_API_KEY);
const remetente = () => limparValor(process.env.EMAIL_REMETENTE) || "Sempre Zero <onboarding@resend.dev>";
export const emailConfigurado = () => Boolean(resendChave());

/**
 * Envia um aviso para usuários: grava na central de avisos do app,
 * manda notificação para os celulares inscritos e um e-mail (se configurado).
 * Nunca lança erro: falhas de envio não podem atrapalhar a ação principal.
 */
export async function notificar(usuarioIds: (string | null | undefined)[], aviso: Aviso, siteUrl: string, opcoes: { email?: boolean } = {}) {
  const ids = [...new Set(usuarioIds)].filter((x): x is string => Boolean(x));
  const admin = createAdminClient();
  if (!admin || ids.length === 0) return;

  try {
    for (let i = 0; i < ids.length; i += 500) {
      await admin.from("notificacoes").insert(
        ids.slice(i, i + 500).map((usuario_id) => ({ usuario_id, titulo: aviso.titulo, corpo: aviso.corpo ?? null, link: aviso.link ?? null })),
      );
    }
  } catch (e) {
    console.error("[notificar] central de avisos", e);
  }

  await Promise.allSettled([
    enviarPush(admin, ids, aviso),
    opcoes.email === false ? Promise.resolve() : enviarEmails(admin, ids, aviso, siteUrl),
  ]);
}

/** Avisa todos os administradores (a empresa). */
export async function notificarEmpresa(aviso: Aviso, siteUrl: string) {
  const admin = createAdminClient();
  if (!admin) return;
  const { data } = await admin.from("perfis").select("id").eq("papel", "admin");
  await notificar((data ?? []).map((p) => p.id), aviso, siteUrl);
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

async function enviarPush(admin: AdminClient, ids: string[], aviso: Aviso) {
  if (!pushConfigurado()) return;
  webpush.setVapidDetails("mailto:contato@semprezero.app", vapidPublica(), vapidPrivada());

  const inscricoes: { id: string; endpoint: string; p256dh: string; auth: string }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from("push_inscricoes").select("id, endpoint, p256dh, auth").in("usuario_id", ids.slice(i, i + 200));
    inscricoes.push(...(data ?? []));
  }

  const carga = JSON.stringify({ titulo: aviso.titulo, corpo: aviso.corpo ?? "", link: aviso.link ?? "/notificacoes" });
  const expiradas: string[] = [];

  await Promise.allSettled(
    inscricoes.map(async (i) => {
      try {
        await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, carga, {
          TTL: 60 * 60 * 24,
          urgency: "high",
        });
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410: o aparelho cancelou a inscrição
        if (status === 404 || status === 410) expiradas.push(i.id);
        else console.error("[notificar] push", status, (e as Error).message);
      }
    }),
  );

  if (expiradas.length) await admin.from("push_inscricoes").delete().in("id", expiradas);
}

async function enviarEmails(admin: AdminClient, ids: string[], aviso: Aviso, siteUrl: string) {
  if (!emailConfigurado()) return;
  const perfis: { email: string | null; nome: string | null }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from("perfis").select("email, nome").in("id", ids.slice(i, i + 200));
    perfis.push(...(data ?? []));
  }
  const link = aviso.link?.startsWith("http") ? aviso.link : `${siteUrl}${aviso.link ?? "/notificacoes"}`;
  const emails = perfis
    .filter((p) => p.email)
    .map((p) => ({ from: remetente(), to: [p.email as string], subject: aviso.titulo, html: modeloEmail(p.nome, aviso, link) }));

  // Envio em lotes de até 100 (limite do Resend por chamada)
  for (let i = 0; i < emails.length; i += 100) {
    const lote = emails.slice(i, i + 100);
    const r = await fetch(lote.length === 1 ? "https://api.resend.com/emails" : "https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendChave()}`, "Content-Type": "application/json" },
      body: JSON.stringify(lote.length === 1 ? lote[0] : lote),
    });
    if (!r.ok) console.error("[notificar] e-mail", r.status, await r.text());
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function modeloEmail(nome: string | null, aviso: Aviso, link: string) {
  const primeiro = (nome ?? "").trim().split(/\s+/)[0];
  return `<!doctype html><html><body style="margin:0;background:#f4f6f9;font-family:Arial,sans-serif;color:#0b1220">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e7ee">
<tr><td style="background:#0b1220;padding:18px 24px;color:#fff;font-size:18px;font-weight:bold">Sempre<span style="color:#12b5b0">Zero</span></td></tr>
<tr><td style="padding:24px">
${primeiro ? `<p style="margin:0 0 8px;color:#5b6779">Olá, ${esc(primeiro)}!</p>` : ""}
<h1 style="margin:0 0 12px;font-size:20px">${esc(aviso.titulo)}</h1>
${aviso.corpo ? `<p style="margin:0 0 20px;line-height:1.5;color:#5b6779">${esc(aviso.corpo)}</p>` : ""}
<a href="${esc(link)}" style="display:inline-block;background:#12b5b0;color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">Abrir no app</a>
</td></tr></table>
<p style="color:#5b6779;font-size:12px;margin-top:16px">Você recebe este e-mail porque tem uma garagem digital na Sempre Zero.</p>
</td></tr></table></body></html>`;
}
