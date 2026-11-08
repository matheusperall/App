import "server-only";
import { createSign } from "node:crypto";
import { limparValor } from "@/lib/env";

/**
 * Google Agenda via "conta de serviço" (service account):
 * a agenda da empresa é compartilhada com o e-mail da conta de serviço,
 * e o app cria/consulta eventos por ela. Sem login do Google para o cliente.
 *
 * Variáveis:
 *   GOOGLE_SERVICE_ACCOUNT_JSON — o arquivo JSON da chave, colado inteiro
 *   GOOGLE_CALENDAR_ID          — o ID da agenda (normalmente o seu e-mail do Gmail)
 */
type Credenciais = { client_email: string; private_key: string };

function credenciais(): Credenciais | null {
  const bruto = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "").trim();
  if (!bruto) return null;
  try {
    const json = JSON.parse(bruto) as Partial<Credenciais>;
    if (!json.client_email || !json.private_key) return null;
    return { client_email: json.client_email, private_key: json.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export const agendaId = () => limparValor(process.env.GOOGLE_CALENDAR_ID);
export const googleConfigurado = () => Boolean(credenciais() && agendaId());
export const emailContaServico = () => credenciais()?.client_email ?? null;

let tokenCache: { valor: string; expira: number } | null = null;

async function token() {
  if (tokenCache && tokenCache.expira > Date.now() + 60_000) return tokenCache.valor;
  const c = credenciais();
  if (!c) throw new Error("Google Agenda não configurada");
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const corpo = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: c.client_email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: agora,
    exp: agora + 3600,
  })}`;
  const assinatura = createSign("RSA-SHA256").update(corpo).sign(c.private_key).toString("base64url");

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${corpo}.${assinatura}` }),
    cache: "no-store",
  });
  const json = (await r.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!r.ok || !json.access_token) throw new Error(`Google recusou as credenciais: ${json.error_description ?? r.status}`);
  tokenCache = { valor: json.access_token, expira: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`https://www.googleapis.com/calendar/v3${caminho}`, {
    ...init,
    headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (r.status === 204) return undefined as T;
  const json = (await r.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!r.ok) throw new Error(`Google Agenda: ${json.error?.message ?? r.status}`);
  return json;
}

/** Intervalos ocupados na agenda da empresa. */
export async function ocupadosGoogle(de: Date, ate: Date) {
  const r = await chamar<{ calendars: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason: string }[] }> }>(
    "/freeBusy",
    { method: "POST", body: JSON.stringify({ timeMin: de.toISOString(), timeMax: ate.toISOString(), timeZone: "America/Sao_Paulo", items: [{ id: agendaId() }] }) },
  );
  const cal = r.calendars?.[agendaId()];
  if (cal?.errors?.length) throw new Error(`Google Agenda: sem acesso à agenda (${cal.errors[0].reason}). Ela foi compartilhada com a conta de serviço?`);
  return (cal?.busy ?? []).map((b) => ({ inicio: new Date(b.start), fim: new Date(b.end) }));
}

export type Evento = {
  titulo: string;
  descricao: string;
  inicio: Date;
  fim: Date;
  /** Lavagem ou serviço (só muda a cor). Todos entram como "livre" para não fechar a agenda:
   *  a capacidade de lavagens é controlada pelo app; "ocupado" fica só para os seus bloqueios. */
  ocupa: boolean;
};

export async function criarEvento(e: Evento) {
  const r = await chamar<{ id: string }>(`/calendars/${encodeURIComponent(agendaId())}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary: e.titulo,
      description: e.descricao,
      start: { dateTime: e.inicio.toISOString(), timeZone: "America/Sao_Paulo" },
      end: { dateTime: e.fim.toISOString(), timeZone: "America/Sao_Paulo" },
      transparency: "transparent",
      colorId: e.ocupa ? "7" : "5",
    }),
  });
  return r.id;
}

export async function atualizarEvento(id: string, e: Evento) {
  await chamar(`/calendars/${encodeURIComponent(agendaId())}/events/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      summary: e.titulo,
      description: e.descricao,
      start: { dateTime: e.inicio.toISOString(), timeZone: "America/Sao_Paulo" },
      end: { dateTime: e.fim.toISOString(), timeZone: "America/Sao_Paulo" },
      transparency: "transparent",
    }),
  });
}

export async function excluirEvento(id: string) {
  try {
    await chamar(`/calendars/${encodeURIComponent(agendaId())}/events/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (e) {
    console.error("[google] excluir evento", (e as Error).message);
  }
}

/** Testa a conexão: lê a agenda de hoje. */
export async function testarGoogle() {
  const agora = new Date();
  await ocupadosGoogle(agora, new Date(agora.getTime() + 86400_000));
  return true;
}
