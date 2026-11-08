"use server";

import { revalidatePath } from "next/cache";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { notificar } from "@/lib/notificar";
import { getSiteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TIPOS_COMUNICADO, type TipoComunicado } from "./tipos";

const texto = (f: FormData, n: string) => String(f.get(n) ?? "").trim();

/** Envia um comunicado para todos os clientes: central de avisos + celular (+ e-mail, se marcado). */
export async function enviarComunicado(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return { erro: "Modo demonstração: conecte o banco de dados para enviar." };
  const usuario = await exigirAdmin();
  const tipo = texto(form, "tipo") as TipoComunicado;
  if (!(tipo in TIPOS_COMUNICADO)) return { erro: "Escolha o tipo do comunicado." };
  const titulo = texto(form, "titulo").slice(0, 80);
  const mensagem = texto(form, "mensagem").slice(0, 500);
  if (titulo.length < 3) return { erro: "Escreva um título." };
  if (mensagem.length < 5) return { erro: "Escreva a mensagem." };

  let link = texto(form, "link");
  if (link === "outro") link = texto(form, "link_externo");
  if (link && !link.startsWith("/") && !/^https:\/\//.test(link)) return { erro: "O link externo deve começar com https://" };
  const porEmail = form.get("por_email") === "on";

  const admin = createAdminClient();
  if (!admin) return { erro: "Servidor sem a chave SUPABASE_SERVICE_ROLE_KEY." };
  const { data: clientes } = await admin.from("perfis").select("id").eq("papel", "cliente");
  const ids = (clientes ?? []).map((c) => c.id as string);
  if (ids.length === 0) return { erro: "Ainda não há clientes cadastrados." };

  await notificar(
    ids,
    { titulo: `${TIPOS_COMUNICADO[tipo].icone} ${titulo}`, corpo: mensagem, link: link || "/notificacoes" },
    await getSiteUrl(),
    { email: porEmail },
  );

  const supabase = await createClient();
  await supabase.from("comunicados").insert({
    tipo,
    titulo,
    mensagem,
    link: link || null,
    por_email: porEmail,
    destinatarios: ids.length,
    enviado_por: usuario.id,
  });

  revalidatePath("/painel/comunicados");
  return { sucesso: `Comunicado enviado para ${ids.length} ${ids.length === 1 ? "cliente" : "clientes"}.` };
}
