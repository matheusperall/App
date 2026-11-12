"use server";

import { revalidatePath } from "next/cache";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirUsuario } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { TIPOS_ANEXO, pastaFotos } from "@/lib/garagem";
import { createClient } from "@/lib/supabase/server";

const texto = (f: FormData, n: string) => String(f.get(n) ?? "").trim();
const TIPOS_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * Registra um arquivo que o navegador já enviou para o Storage (bucket "documentos").
 * Do veículo (veiculo_id) ou pessoal (CNH). Só aceita caminhos dentro da pasta certa.
 */
export async function registrarAnexo(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return { erro: "Modo demonstração: o envio de arquivos funciona depois de conectar o banco." };
  const usuario = await exigirUsuario();
  const supabase = await createClient();
  const veiculoId = texto(form, "veiculo_id");
  const tipo = texto(form, "tipo");
  const caminho = texto(form, "caminho");
  const nome = texto(form, "nome").slice(0, 120) || "documento";
  const mime = texto(form, "tipo_mime");
  if (!(tipo in TIPOS_ANEXO)) return { erro: "Escolha o tipo do documento." };
  if (!TIPOS_MIME.includes(mime)) return { erro: "Envie um PDF ou uma foto (JPG, PNG)." };
  if (caminho.includes("..")) return { erro: "Arquivo inválido." };

  let pasta = usuario.id;
  if (veiculoId) {
    const { data: v } = await supabase.from("veiculos").select("*").eq("id", veiculoId).maybeSingle();
    if (!v) return { erro: "Veículo não encontrado." };
    pasta = pastaFotos(v);
  }
  if (!caminho.startsWith(`${pasta}/`)) return { erro: "Arquivo inválido." };

  const { error } = await supabase.from("documentos_arquivos").insert({
    dono_id: veiculoId ? null : usuario.id,
    veiculo_id: veiculoId || null,
    tipo,
    nome,
    caminho,
    tamanho: Number(texto(form, "tamanho")) || null,
    tipo_mime: mime,
    enviado_por: usuario.id,
  });
  if (error) {
    console.error("[anexos]", error);
    await supabase.storage.from("documentos").remove([caminho]);
    if (error.code === "42P01" || error.code === "PGRST205") return { erro: "Falta atualizar o banco: rode o arquivo 0014_anexos_documentos.sql no Supabase." };
    return { erro: "Não foi possível salvar o arquivo." };
  }
  revalidatePath(veiculoId ? `/garagem/${veiculoId}/documentos` : "/garagem");
  return { sucesso: "Arquivo anexado." };
}

export async function removerAnexo(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return { erro: "Modo demonstração." };
  await exigirUsuario();
  const supabase = await createClient();
  const { data: a } = await supabase.from("documentos_arquivos").select("id, caminho, veiculo_id").eq("id", texto(form, "id")).maybeSingle();
  if (!a) return { erro: "Arquivo não encontrado." };
  const { error } = await supabase.from("documentos_arquivos").delete().eq("id", a.id);
  if (error) return { erro: "Não foi possível remover." };
  await supabase.storage.from("documentos").remove([a.caminho]);
  revalidatePath(a.veiculo_id ? `/garagem/${a.veiculo_id}/documentos` : "/garagem");
  return { sucesso: "Arquivo removido." };
}
