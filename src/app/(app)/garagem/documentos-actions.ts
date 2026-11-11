"use server";

import { revalidatePath } from "next/cache";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirUsuario } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { TIPOS_DOCUMENTO, type TipoDocumento } from "@/lib/garagem";
import { createClient } from "@/lib/supabase/server";

const texto = (f: FormData, n: string) => String(f.get(n) ?? "").trim();
const dataValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Salva (ou remove) um documento: do veículo (licenciamento, IPVA, seguro) ou da pessoa (CNH). */
export async function salvarDocumento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return { erro: "Modo demonstração: conecte o banco de dados para salvar." };
  const usuario = await exigirUsuario();
  const supabase = await createClient();

  const tipo = texto(form, "tipo") as TipoDocumento;
  if (!(tipo in TIPOS_DOCUMENTO)) return { erro: "Tipo de documento inválido." };
  const veiculoId = TIPOS_DOCUMENTO[tipo].doVeiculo ? texto(form, "veiculo_id") : "";
  const id = texto(form, "id");

  // Dono: o do veículo (a empresa pode cuidar dos documentos do cliente) ou o próprio usuário (CNH)
  let donoId: string | null = usuario.id;
  if (veiculoId) {
    const { data: v } = await supabase.from("veiculos").select("dono_id").eq("id", veiculoId).maybeSingle();
    if (!v) return { erro: "Veículo não encontrado." };
    donoId = v.dono_id;
  }

  const caminho = veiculoId ? `/garagem/${veiculoId}` : "/conta";

  if (texto(form, "acao") === "remover") {
    if (id) await supabase.from("documentos").delete().eq("id", id);
    revalidatePath(caminho);
    return { sucesso: "Removido." };
  }

  const vencimento = texto(form, "vencimento");
  if (!dataValida(vencimento)) return { erro: "Informe a data de vencimento." };
  const descricao = texto(form, "descricao").slice(0, 120) || null;
  if (tipo === "outro" && !descricao) return { erro: "Diga qual é o documento ou vencimento." };

  // Procura um já existente do mesmo tipo (um por veículo; CNH uma por pessoa)
  let existenteId = id;
  if (!existenteId && tipo !== "outro") {
    let q = supabase.from("documentos").select("id").eq("tipo", tipo);
    q = veiculoId ? q.eq("veiculo_id", veiculoId) : q.eq("dono_id", usuario.id).is("veiculo_id", null);
    const { data } = await q.maybeSingle();
    existenteId = data?.id ?? "";
  }

  const { error } = existenteId
    ? await supabase.from("documentos").update({ vencimento, descricao }).eq("id", existenteId)
    : await supabase
        .from("documentos")
        .insert({ dono_id: donoId, veiculo_id: veiculoId || null, tipo, vencimento, descricao });
  if (error) {
    console.error("[documentos]", error);
    return { erro: error.code === "42P01" || error.code === "PGRST205" ? "Falta atualizar o banco (arquivo 0005_lembretes.sql)." : "Não foi possível salvar." };
  }

  revalidatePath(caminho);
  return { sucesso: "Salvo! Vamos te lembrar antes do vencimento." };
}
