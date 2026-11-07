import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { hojeISO, somarMeses, type Manutencao, type Servico, type Veiculo } from "@/lib/garagem";

// Todas as leituras passam pelo Supabase com a sessão do usuário,
// então as regras de segurança do banco (RLS) decidem o que cada um vê.

export type Dono = { id: string; nome: string; email: string | null; telefone: string | null };
export type VeiculoComDono = Veiculo & { dono: Dono | null };
export type Cliente = Dono & { criado_em: string; veiculos: { id: string; placa: string; modelo: string }[] };

const CAMPOS_VEICULO =
  "id, dono_id, placa, marca, modelo, ano, cor, apelido, km_atual, km_atualizado_em, foto";

export async function listarVeiculos(donoId: string): Promise<Veiculo[]> {
  if (!isSupabaseConfigured) return DEMO.veiculos.filter((v) => v.dono_id === donoId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("veiculos")
    .select(CAMPOS_VEICULO)
    .eq("dono_id", donoId)
    .order("criado_em");
  return data ?? [];
}

export async function obterVeiculo(id: string): Promise<VeiculoComDono | null> {
  if (!isSupabaseConfigured) {
    const v = DEMO.veiculos.find((x) => x.id === id);
    return v ? { ...v, dono: DEMO.dono } : null;
  }
  if (!ehUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("veiculos")
    .select(`${CAMPOS_VEICULO}, dono:perfis!veiculos_dono_id_fkey (id, nome, email, telefone)`)
    .eq("id", id)
    .maybeSingle();
  return (data as VeiculoComDono | null) ?? null;
}

export async function listarServicos(veiculoId: string): Promise<Servico[]> {
  if (!isSupabaseConfigured) return DEMO.servicos.filter((s) => s.veiculo_id === veiculoId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("servicos")
    .select("id, veiculo_id, data, categoria, titulo, descricao, km, valor, prestador, fotos, pela_empresa")
    .eq("veiculo_id", veiculoId)
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false });
  return (data as Servico[] | null) ?? [];
}

export async function obterServico(id: string): Promise<Servico | null> {
  if (!isSupabaseConfigured) return DEMO.servicos.find((s) => s.id === id) ?? null;
  if (!ehUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("servicos")
    .select("id, veiculo_id, data, categoria, titulo, descricao, km, valor, prestador, fotos, pela_empresa")
    .eq("id", id)
    .maybeSingle();
  return (data as Servico | null) ?? null;
}

export async function listarManutencoes(veiculoIds: string[]): Promise<Manutencao[]> {
  if (veiculoIds.length === 0) return [];
  if (!isSupabaseConfigured) return DEMO.manutencoes.filter((m) => veiculoIds.includes(m.veiculo_id));
  const supabase = await createClient();
  const { data } = await supabase
    .from("manutencoes")
    .select("id, veiculo_id, tipo, ultima_data, ultimo_km, intervalo_meses, intervalo_km, proxima_data, proximo_km, definido_pela_empresa")
    .in("veiculo_id", veiculoIds);
  return data ?? [];
}

/** Links temporários (1 hora) para exibir fotos privadas. */
export async function urlsDasFotos(caminhos: (string | null | undefined)[]): Promise<Record<string, string>> {
  const lista = [...new Set(caminhos.filter((c): c is string => Boolean(c)))];
  if (lista.length === 0 || !isSupabaseConfigured) return {};
  const supabase = await createClient();
  const { data } = await supabase.storage.from("fotos").createSignedUrls(lista, 3600);
  const mapa: Record<string, string> = {};
  data?.forEach((d) => {
    if (d.path && d.signedUrl) mapa[d.path] = d.signedUrl;
  });
  return mapa;
}

// ---------------------------------------------------------------------------
// Área da empresa
// ---------------------------------------------------------------------------
export async function listarClientes(busca: string): Promise<Cliente[]> {
  if (!isSupabaseConfigured) {
    return [{ ...DEMO.dono, criado_em: "2026-11-01T12:00:00Z", veiculos: DEMO.veiculos.map(({ id, placa, modelo }) => ({ id, placa, modelo })) }];
  }
  const supabase = await createClient();
  const termo = busca.trim().replace(/[%,()]/g, " ").trim();

  let idsPorPlaca: string[] = [];
  if (termo) {
    const placa = termo.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (placa.length >= 3) {
      const { data } = await supabase.from("veiculos").select("dono_id").ilike("placa", `%${placa}%`).limit(50);
      idsPorPlaca = (data ?? []).map((d) => d.dono_id);
    }
  }

  let consulta = supabase
    .from("perfis")
    .select("id, nome, email, telefone, criado_em, veiculos!veiculos_dono_id_fkey (id, placa, modelo)")
    .eq("papel", "cliente")
    .order("nome")
    .limit(100);

  if (termo) {
    const filtros = [`nome.ilike.%${termo}%`, `email.ilike.%${termo}%`, `telefone.ilike.%${termo}%`];
    if (idsPorPlaca.length) filtros.push(`id.in.(${idsPorPlaca.join(",")})`);
    consulta = consulta.or(filtros.join(","));
  }

  const { data } = await consulta;
  return (data as Cliente[] | null) ?? [];
}

export async function obterCliente(id: string): Promise<Dono | null> {
  if (!isSupabaseConfigured) return id === DEMO.dono.id ? DEMO.dono : null;
  if (!ehUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("perfis").select("id, nome, email, telefone").eq("id", id).maybeSingle();
  return data;
}

export async function contarPainel() {
  if (!isSupabaseConfigured) return { clientes: 1, veiculos: DEMO.veiculos.length };
  const supabase = await createClient();
  const [c, v] = await Promise.all([
    supabase.from("perfis").select("id", { count: "exact", head: true }).eq("papel", "cliente"),
    supabase.from("veiculos").select("id", { count: "exact", head: true }),
  ]);
  return { clientes: c.count ?? 0, veiculos: v.count ?? 0 };
}

function ehUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// ---------------------------------------------------------------------------
// Dados de demonstração (usados só enquanto o banco não está conectado)
// ---------------------------------------------------------------------------
const hoje = hojeISO();
const DEMO = {
  dono: { id: "demo", nome: "Cliente Demonstração", email: "demo@semprezero.app", telefone: "(11) 90000-0000" },
  veiculos: [
    {
      id: "demo-civic",
      dono_id: "demo",
      placa: "BRA2E19",
      marca: "Honda",
      modelo: "Civic EXL",
      ano: 2021,
      cor: "Prata",
      apelido: null,
      km_atual: 48200,
      km_atualizado_em: `${hoje}T12:00:00Z`,
      foto: null,
    },
  ] satisfies Veiculo[],
  servicos: [
    {
      id: "demo-s1",
      veiculo_id: "demo-civic",
      data: somarMeses(hoje, -2),
      categoria: "estetica",
      titulo: "Polimento técnico e vitrificação",
      descricao: "Polimento em 3 etapas e aplicação de vitrificação cerâmica.",
      km: 47100,
      valor: 1800,
      prestador: "proprio",
      fotos: [],
      pela_empresa: true,
    },
    {
      id: "demo-s2",
      veiculo_id: "demo-civic",
      data: somarMeses(hoje, -11),
      categoria: "mecanica",
      titulo: "Troca de óleo e filtro",
      descricao: "Óleo 0W-20 sintético.",
      km: 39000,
      valor: 420,
      prestador: "terceirizado",
      fotos: [],
      pela_empresa: true,
    },
  ] satisfies Servico[],
  manutencoes: [
    {
      id: "demo-m1",
      veiculo_id: "demo-civic",
      tipo: "oleo",
      ultima_data: somarMeses(hoje, -11),
      ultimo_km: 39000,
      intervalo_meses: 12,
      intervalo_km: 10000,
      proxima_data: somarMeses(hoje, 1),
      proximo_km: 49000,
      definido_pela_empresa: true,
    },
    {
      id: "demo-m2",
      veiculo_id: "demo-civic",
      tipo: "protecao_pintura",
      ultima_data: somarMeses(hoje, -2),
      ultimo_km: 47100,
      intervalo_meses: 6,
      intervalo_km: null,
      proxima_data: somarMeses(hoje, 4),
      proximo_km: null,
      definido_pela_empresa: true,
    },
  ] satisfies Manutencao[],
};
