"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirUsuario } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import {
  CATEGORIAS,
  calcularProxima,
  ehTipoManutencao,
  hojeISO,
  normalizarPlaca,
  placaValida,
} from "@/lib/garagem";
import { createClient } from "@/lib/supabase/server";
import { registrarLeitura } from "@/lib/ritmo";

const DEMO: EstadoForm = { erro: "Modo demonstração: conecte o banco de dados para salvar." };

const texto = (f: FormData, n: string) => String(f.get(n) ?? "").trim();
const textoOuNulo = (f: FormData, n: string) => texto(f, n) || null;
function inteiro(f: FormData, n: string): number | null {
  const s = texto(f, n).replace(/\D/g, "");
  return s ? Number.parseInt(s, 10) : null;
}
function dinheiro(f: FormData, n: string): number | null {
  const s = texto(f, n).replace(/[^\d,.-]/g, "");
  if (!s) return null;
  // aceita "1.234,56" e "1234.56"
  const v = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
}
const dataValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Só aceita fotos que estejam na pasta do dono do veículo. */
function fotosDaPasta(f: FormData, donoId: string) {
  return f
    .getAll("fotos")
    .map(String)
    .filter((p) => p.startsWith(`${donoId}/`) && !p.includes(".."))
    .slice(0, 12);
}

// ---------------------------------------------------------------------------
// Veículos
// ---------------------------------------------------------------------------
export async function salvarVeiculo(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  const usuario = await exigirUsuario();
  const supabase = await createClient();

  const id = texto(form, "id");
  const placa = normalizarPlaca(texto(form, "placa"));
  if (!placaValida(placa)) return { erro: "Placa inválida. Use o formato ABC1234 ou ABC1D23." };
  const marca = texto(form, "marca");
  const modelo = texto(form, "modelo");
  if (!marca || !modelo) return { erro: "Escolha a marca, o modelo e o ano do veículo (ou preencha manualmente)." };
  const ano = inteiro(form, "ano");
  const anoMax = Number(hojeISO().slice(0, 4)) + 1;
  if (ano != null && (ano < 1950 || ano > anoMax)) return { erro: "Ano inválido." };
  const km = inteiro(form, "km_atual") ?? 0;

  // Dono: a empresa pode cadastrar para um cliente; o cliente, só para si.
  let donoId = usuario.id;
  let kmAnterior = 0;
  if (id) {
    const { data: atual } = await supabase.from("veiculos").select("dono_id, km_atual").eq("id", id).maybeSingle();
    if (!atual) return { erro: "Veículo não encontrado." };
    donoId = atual.dono_id;
    kmAnterior = atual.km_atual;
  } else if (usuario.papel === "admin" && texto(form, "dono_id")) {
    donoId = texto(form, "dono_id");
  }

  const foto = fotosDaPasta(form, donoId)[0] ?? null;
  const tipo = ["carro", "moto", "caminhao"].includes(texto(form, "tipo")) ? texto(form, "tipo") : "carro";
  const basicos = {
    placa,
    marca,
    modelo,
    ano,
    cor: textoOuNulo(form, "cor"),
    apelido: textoOuNulo(form, "apelido"),
    km_atual: km,
    foto,
  };
  const uf = texto(form, "uf").toUpperCase();
  const fipe = {
    uf: /^[A-Z]{2}$/.test(uf) ? uf : "SP",
    tipo,
    combustivel: textoOuNulo(form, "combustivel"),
    codigo_fipe: textoOuNulo(form, "codigo_fipe"),
    valor_fipe: dinheiro(form, "valor_fipe"),
    fipe_referencia: textoOuNulo(form, "fipe_referencia"),
    fipe_marca_cod: textoOuNulo(form, "fipe_marca_cod"),
    fipe_modelo_cod: textoOuNulo(form, "fipe_modelo_cod"),
    fipe_ano_cod: textoOuNulo(form, "fipe_ano_cod"),
  };

  const gravar = (dados: Record<string, unknown>) =>
    id
      ? supabase.from("veiculos").update(dados).eq("id", id).select("id").single()
      : supabase
          .from("veiculos")
          .insert({ ...dados, dono_id: donoId, criado_por: usuario.id })
          .select("id")
          .single();

  let resultado = await gravar({ ...basicos, ...fipe });
  // Banco ainda sem as colunas da FIPE (migração 0004): salva só o básico.
  if (resultado.error?.code === "42703") resultado = await gravar(basicos);

  if (resultado.error) {
    if (resultado.error.code === "23505") return { erro: "Esta placa já está cadastrada." };
    return { erro: "Não foi possível salvar o veículo. Tente novamente." };
  }

  // Histórico do hodômetro: leitura inicial no cadastro, ou nova leitura se o km mudou na edição
  if (km > 0 && (!id || km !== kmAnterior)) {
    await registrarLeitura(supabase, resultado.data.id, km, !id ? "cadastro" : usuario.papel === "admin" ? "empresa" : "cliente");
  }

  revalidatePath("/garagem");
  redirect(`/garagem/${resultado.data.id}`);
}

export async function excluirVeiculo(form: FormData) {
  if (!isSupabaseConfigured) return;
  await exigirUsuario();
  const id = texto(form, "id");
  const supabase = await createClient();
  const { data: v } = await supabase.from("veiculos").select("dono_id").eq("id", id).maybeSingle();
  await supabase.from("veiculos").delete().eq("id", id);
  revalidatePath("/garagem");
  redirect(texto(form, "voltar") === "cliente" && v ? `/painel/clientes/${v.dono_id}` : "/garagem");
}

export async function atualizarKm(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  const usuario = await exigirUsuario();
  const id = texto(form, "id");
  const km = inteiro(form, "km");
  if (km == null) return { erro: "Informe a quilometragem." };

  const supabase = await createClient();
  const { data: v } = await supabase.from("veiculos").select("km_atual").eq("id", id).maybeSingle();
  if (!v) return { erro: "Veículo não encontrado." };
  if (km < v.km_atual && usuario.papel !== "admin")
    return { erro: `A quilometragem não pode ser menor que a atual (${v.km_atual.toLocaleString("pt-BR")} km).` };

  const { error } = await supabase
    .from("veiculos")
    .update({ km_atual: km, km_atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { erro: "Não foi possível atualizar." };
  await registrarLeitura(supabase, id, km, usuario.papel === "admin" ? "empresa" : "cliente");

  revalidatePath(`/garagem/${id}`);
  return { sucesso: "Quilometragem atualizada." };
}

// ---------------------------------------------------------------------------
// Serviços
// ---------------------------------------------------------------------------
export async function registrarServico(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  const usuario = await exigirUsuario();
  const supabase = await createClient();
  const admin = usuario.papel === "admin";

  const veiculoId = texto(form, "veiculo_id");
  const { data: veiculo } = await supabase
    .from("veiculos")
    .select("id, dono_id, km_atual")
    .eq("id", veiculoId)
    .maybeSingle();
  if (!veiculo) return { erro: "Veículo não encontrado." };

  const data = texto(form, "data");
  if (!dataValida(data)) return { erro: "Informe a data do serviço." };
  if (data > hojeISO()) return { erro: "A data do serviço não pode ser no futuro." };
  const categoria = texto(form, "categoria");
  if (!(categoria in CATEGORIAS)) return { erro: "Escolha a categoria." };
  const titulo = texto(form, "titulo");
  if (titulo.length < 3) return { erro: "Descreva o serviço em poucas palavras (ex.: Troca de óleo)." };
  const km = inteiro(form, "km");
  const prestador = texto(form, "prestador") === "terceirizado" ? "terceirizado" : "proprio";

  const { error } = await supabase.from("servicos").insert({
    veiculo_id: veiculoId,
    data,
    categoria,
    titulo,
    descricao: textoOuNulo(form, "descricao"),
    km,
    valor: dinheiro(form, "valor"),
    prestador: admin ? prestador : "externo",
    fotos: fotosDaPasta(form, veiculo.dono_id),
  });
  if (error) return { erro: "Não foi possível registrar o serviço." };

  // Renova uma manutenção periódica (ex.: troca de óleo)
  const tipo = texto(form, "manutencao");
  if (ehTipoManutencao(tipo)) {
    const intervaloMeses = inteiro(form, "intervalo_meses");
    const intervaloKm = inteiro(form, "intervalo_km");
    const calculada = calcularProxima(data, km, intervaloMeses, intervaloKm);
    const proximaData = texto(form, "proxima_data");
    await supabase.from("manutencoes").upsert(
      {
        veiculo_id: veiculoId,
        tipo,
        ultima_data: data,
        ultimo_km: km,
        intervalo_meses: intervaloMeses,
        intervalo_km: intervaloKm,
        proxima_data: dataValida(proximaData) ? proximaData : calculada.proxima_data,
        proximo_km: inteiro(form, "proximo_km") ?? calculada.proximo_km,
        definido_pela_empresa: admin,
      },
      { onConflict: "veiculo_id,tipo" },
    );
  }

  // O km informado no serviço entra no histórico do hodômetro (e ajuda a calcular o ritmo de uso)
  if (km != null) await registrarLeitura(supabase, veiculoId, km, "servico", data);

  // Atualiza o hodômetro se o serviço trouxe uma quilometragem maior
  if (km != null && km > veiculo.km_atual) {
    await supabase
      .from("veiculos")
      .update({ km_atual: km, km_atualizado_em: new Date().toISOString() })
      .eq("id", veiculoId);
  }

  revalidatePath(`/garagem/${veiculoId}`);
  redirect(`/garagem/${veiculoId}?registrado=1`);
}

export async function excluirServico(form: FormData) {
  if (!isSupabaseConfigured) return;
  await exigirUsuario();
  const id = texto(form, "id");
  const veiculoId = texto(form, "veiculo_id");
  const supabase = await createClient();
  await supabase.from("servicos").delete().eq("id", id);
  revalidatePath(`/garagem/${veiculoId}`);
  redirect(`/garagem/${veiculoId}`);
}

// ---------------------------------------------------------------------------
// Manutenções (ajuste manual dos intervalos e da próxima data/km)
// ---------------------------------------------------------------------------
export async function salvarManutencao(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  const usuario = await exigirUsuario();
  const veiculoId = texto(form, "veiculo_id");
  const tipo = texto(form, "tipo");
  if (!ehTipoManutencao(tipo)) return { erro: "Tipo de manutenção inválido." };
  const supabase = await createClient();

  if (texto(form, "acao") === "remover") {
    await supabase.from("manutencoes").delete().eq("veiculo_id", veiculoId).eq("tipo", tipo);
    revalidatePath(`/garagem/${veiculoId}`);
    return { sucesso: "Lembrete removido." };
  }

  const ultimaData = texto(form, "ultima_data");
  const ultimoKm = inteiro(form, "ultimo_km");
  const intervaloMeses = inteiro(form, "intervalo_meses");
  const intervaloKm = inteiro(form, "intervalo_km");
  if (!intervaloMeses && !intervaloKm) return { erro: "Informe ao menos um intervalo (meses ou km)." };

  const calculada = calcularProxima(dataValida(ultimaData) ? ultimaData : null, ultimoKm, intervaloMeses, intervaloKm);
  const proximaData = texto(form, "proxima_data");
  const proximoKm = inteiro(form, "proximo_km");

  const { error } = await supabase.from("manutencoes").upsert(
    {
      veiculo_id: veiculoId,
      tipo,
      ultima_data: dataValida(ultimaData) ? ultimaData : null,
      ultimo_km: ultimoKm,
      intervalo_meses: intervaloMeses,
      intervalo_km: intervaloKm,
      proxima_data: dataValida(proximaData) ? proximaData : calculada.proxima_data,
      proximo_km: proximoKm ?? calculada.proximo_km,
      definido_pela_empresa: usuario.papel === "admin",
    },
    { onConflict: "veiculo_id,tipo" },
  );
  if (error) return { erro: "Não foi possível salvar." };

  revalidatePath(`/garagem/${veiculoId}`);
  return { sucesso: "Lembrete salvo." };
}
