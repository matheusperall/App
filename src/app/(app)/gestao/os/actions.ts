"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { CATEGORIAS, hojeISO, nomeVeiculo, normalizarPlaca, placaValida } from "@/lib/garagem";
import { STATUS_OS, arred, ehFormaPagamento, type StatusOS } from "@/lib/gestao";
import { notificar } from "@/lib/notificar";
import { registrarLeitura } from "@/lib/ritmo";
import { getSiteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

const DEMO: EstadoForm = { erro: "Modo demonstração: conecte o banco de dados para salvar." };
const texto = (f: FormData, n: string) => String(f.get(n) ?? "").trim();
const dataValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Dados enviados pelo formulário de OS (montados no navegador). */
export type DadosOS = {
  id?: string;
  cliente: { id: string } | { novo: { nome: string; telefone: string; lojista: boolean } };
  veiculo:
    | { id: string }
    | {
        novo: {
          placa: string;
          marca: string;
          modelo: string;
          ano: number | null;
          tipo?: string;
          combustivel?: string | null;
          codigo_fipe?: string | null;
          valor_fipe?: number | null;
          fipe_referencia?: string | null;
          fipe_marca_cod?: string | null;
          fipe_modelo_cod?: string | null;
          fipe_ano_cod?: string | null;
        };
      }
    | null;
  itens: { catalogo_id: string | null; nome: string; preco: number; novo?: { categoria: string } }[];
  desconto: number;
  data: string;
  km: number | null;
  observacoes: string;
  agendamento_id?: string | null;
  orcamento_id?: string | null;
};

type Supa = Awaited<ReturnType<typeof createClient>>;

async function resolverCliente(supabase: Supa, c: DadosOS["cliente"]): Promise<{ id: string } | { erro: string }> {
  if ("id" in c) {
    const { data } = await supabase.from("clientes").select("id").eq("id", c.id).maybeSingle();
    return data ? { id: data.id } : { erro: "Cliente não encontrado." };
  }
  const nome = c.novo.nome.trim().slice(0, 120);
  if (nome.length < 2) return { erro: "Informe o nome do novo cliente." };
  const { data, error } = await supabase
    .from("clientes")
    .insert({ nome, telefone: c.novo.telefone.trim() || null, lojista: Boolean(c.novo.lojista) })
    .select("id")
    .single();
  if (error || !data) return { erro: "Não foi possível cadastrar o cliente." };
  return { id: data.id };
}

async function resolverVeiculo(
  supabase: Supa,
  clienteId: string,
  v: DadosOS["veiculo"],
  km: number | null,
): Promise<{ id: string; placa: string; nome: string; dono_id: string | null; km_atual: number } | null | { erro: string }> {
  if (!v) return null;
  if ("id" in v) {
    const { data } = await supabase.from("veiculos").select("id, cliente_id, dono_id, placa, marca, modelo, apelido, km_atual").eq("id", v.id).maybeSingle();
    if (!data) return { erro: "Veículo não encontrado." };
    if (data.cliente_id !== clienteId) return { erro: "Este veículo é de outro cliente." };
    return { id: data.id, placa: data.placa, nome: nomeVeiculo(data), dono_id: data.dono_id, km_atual: data.km_atual };
  }
  const novo = v.novo;
  const placa = normalizarPlaca(novo.placa);
  if (!placaValida(placa)) return { erro: "Placa inválida. Use o formato ABC1234 ou ABC1D23." };
  if (!novo.marca.trim() || !novo.modelo.trim()) return { erro: "Informe a marca e o modelo do veículo." };

  // A placa já existe? Se for deste cliente, usa o mesmo veículo.
  const { data: existente } = await supabase
    .from("veiculos")
    .select("id, cliente_id, dono_id, placa, marca, modelo, apelido, km_atual, ficha:clientes (nome)")
    .ilike("placa", placa)
    .maybeSingle();
  if (existente) {
    if (existente.cliente_id !== clienteId) {
      const dono = (existente.ficha as unknown as { nome: string } | null)?.nome;
      return { erro: `A placa ${placa} já está cadastrada${dono ? ` para ${dono}` : ""}. Escolha esse cliente.` };
    }
    return { id: existente.id, placa: existente.placa, nome: nomeVeiculo(existente), dono_id: existente.dono_id, km_atual: existente.km_atual };
  }

  const anoMax = Number(hojeISO().slice(0, 4)) + 1;
  const ano = novo.ano && novo.ano >= 1950 && novo.ano <= anoMax ? novo.ano : null;
  const { data, error } = await supabase
    .from("veiculos")
    .insert({
      cliente_id: clienteId,
      placa,
      marca: novo.marca.trim().slice(0, 60),
      modelo: novo.modelo.trim().slice(0, 120),
      ano,
      km_atual: km ?? 0,
      tipo: ["carro", "moto", "caminhao"].includes(novo.tipo ?? "") ? novo.tipo : "carro",
      combustivel: novo.combustivel || null,
      codigo_fipe: novo.codigo_fipe || null,
      valor_fipe: novo.valor_fipe ?? null,
      fipe_referencia: novo.fipe_referencia || null,
      fipe_marca_cod: novo.fipe_marca_cod || null,
      fipe_modelo_cod: novo.fipe_modelo_cod || null,
      fipe_ano_cod: novo.fipe_ano_cod || null,
    })
    .select("id, dono_id, placa, marca, modelo, apelido, km_atual")
    .single();
  if (error || !data) {
    console.error("[os] novo veículo", error);
    return { erro: error?.code === "23505" ? "Esta placa já está cadastrada." : "Não foi possível cadastrar o veículo." };
  }
  if (km) await registrarLeitura(supabase, data.id, km, "cadastro");
  return { id: data.id, placa: data.placa, nome: nomeVeiculo(data), dono_id: data.dono_id, km_atual: data.km_atual };
}

/** Itens novos ("cadastrar serviço ali mesmo") entram no catálogo. */
async function resolverItens(supabase: Supa, itens: DadosOS["itens"]) {
  const lista: { catalogo_id: string | null; nome: string; preco: number; ordem: number }[] = [];
  for (const [ordem, i] of itens.entries()) {
    const nome = i.nome.trim().slice(0, 120);
    const preco = arred(Math.max(0, Number(i.preco) || 0));
    if (!nome) continue;
    let catalogoId = i.catalogo_id;
    if (!catalogoId && i.novo) {
      const categoria = i.novo.categoria in CATEGORIAS ? i.novo.categoria : "estetica";
      const { data: ja } = await supabase.from("catalogo_servicos").select("id").ilike("nome", nome).maybeSingle();
      if (ja) catalogoId = ja.id;
      else {
        const { data } = await supabase.from("catalogo_servicos").insert({ nome, preco, categoria }).select("id").single();
        catalogoId = data?.id ?? null;
      }
    }
    lista.push({ catalogo_id: catalogoId, nome, preco, ordem });
  }
  return lista;
}

export async function salvarOS(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  let d: DadosOS;
  try {
    d = JSON.parse(texto(form, "dados")) as DadosOS;
  } catch {
    return { erro: "Dados inválidos. Recarregue a página." };
  }
  if (!dataValida(d.data)) return { erro: "Informe a data da OS." };
  if (!d.itens?.length || !d.itens.some((i) => i.nome.trim())) return { erro: "Adicione pelo menos um serviço." };
  const km = d.km != null && Number.isFinite(d.km) && d.km >= 0 ? Math.round(d.km) : null;

  const supabase = await createClient();

  if (d.id) {
    const { data: atual } = await supabase.from("ordens_servico").select("*").eq("id", d.id).maybeSingle();
    if (!atual) return { erro: "OS não encontrada." };
    if (atual.pago || Number(atual.valor_pago ?? 0) > 0 || atual.fatura_id || !["aberta", "em_andamento"].includes(atual.status))
      return { erro: "Só dá para editar a OS antes de ficar pronta (e sem pagamento ou fatura)." };
  }

  const cliente = await resolverCliente(supabase, d.cliente);
  if ("erro" in cliente) return { erro: cliente.erro };
  const veiculo = await resolverVeiculo(supabase, cliente.id, d.veiculo, km);
  if (veiculo && "erro" in veiculo) return { erro: veiculo.erro };
  const itens = await resolverItens(supabase, d.itens);
  const subtotal = itens.reduce((t, i) => t + i.preco, 0);
  const desconto = arred(Math.min(Math.max(0, Number(d.desconto) || 0), subtotal));

  const campos = {
    cliente_id: cliente.id,
    veiculo_id: veiculo?.id ?? null,
    placa: veiculo?.placa ?? null,
    veiculo_nome: veiculo?.nome ?? null,
    data: d.data,
    km,
    desconto,
    observacoes: d.observacoes.trim().slice(0, 2000) || null,
  };

  let osId = d.id;
  if (osId) {
    const { error } = await supabase.from("ordens_servico").update(campos).eq("id", osId);
    if (error) return { erro: "Não foi possível salvar a OS." };
    await supabase.from("os_itens").delete().eq("os_id", osId);
  } else {
    const { data, error } = await supabase
      .from("ordens_servico")
      .insert({ ...campos, agendamento_id: d.agendamento_id || null, orcamento_id: d.orcamento_id || null })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[os] criar", error);
      return { erro: error?.code === "23505" ? "Este agendamento já tem uma OS aberta." : "Não foi possível criar a OS." };
    }
    osId = data.id;
  }

  const { error: erroItens } = await supabase.from("os_itens").insert(itens.map((i) => ({ ...i, os_id: osId })));
  if (erroItens) {
    if (!d.id) await supabase.from("ordens_servico").delete().eq("id", osId);
    return { erro: "Não foi possível salvar os serviços da OS." };
  }

  // Quilometragem informada maior que a do cadastro: atualiza o veículo
  if (veiculo && km && km > veiculo.km_atual) {
    await supabase.from("veiculos").update({ km_atual: km, km_atualizado_em: new Date().toISOString() }).eq("id", veiculo.id);
    await registrarLeitura(supabase, veiculo.id, km, "empresa");
  }

  revalidatePath("/gestao", "layout");
  redirect(`/gestao/os/${osId}${d.id ? "" : "?nova=1"}`);
}

const ORDEM_STATUS: StatusOS[] = ["aberta", "em_andamento", "pronta", "entregue"];

/** Avança a OS: aberta → em andamento → pronta (baixa o estoque) → entregue (vai para o histórico). */
export async function avancarStatus(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const id = texto(form, "id");
  const para = texto(form, "para") as StatusOS;
  const supabase = await createClient();
  const { data: os } = await supabase
    .from("ordens_servico")
    .select("id, numero, status, data, km, total, veiculo_id, agendamento_id, servico_historico_id, veiculo_nome, placa, cliente:clientes (perfil_id), itens:os_itens (nome, catalogo_id, ordem)")
    .eq("id", id)
    .maybeSingle();
  if (!os) return { erro: "OS não encontrada." };
  const atual = os.status as StatusOS;
  if (STATUS_OS[atual].proximo !== para || ORDEM_STATUS.indexOf(para) < 0) return { erro: "Esta etapa não está disponível. Atualize a página." };

  const agora = new Date().toISOString();
  const site = await getSiteUrl();
  const perfilId = (os.cliente as unknown as { perfil_id: string | null } | null)?.perfil_id ?? null;
  const carro = [os.veiculo_nome, os.placa].filter(Boolean).join(" · ");

  if (para === "pronta") {
    const { error: erroBaixa } = await supabase.rpc("gestao_baixar_estoque_os", { p_os: id });
    if (erroBaixa) {
      console.error("[os] baixa de estoque", erroBaixa);
      return { erro: "Não foi possível dar baixa no estoque." };
    }
    await supabase.from("ordens_servico").update({ status: "pronta", pronta_em: agora }).eq("id", id);
    await notificar([perfilId], { titulo: "Seu carro está pronto! 🚗✨", corpo: `${carro ? `${carro} — ` : ""}pode vir buscar quando quiser.`, link: os.veiculo_id ? `/garagem/${os.veiculo_id}` : "/garagem" }, site);
  } else if (para === "entregue") {
    let historicoId = os.servico_historico_id as string | null;
    if (os.veiculo_id && !historicoId) {
      const itens = [...((os.itens as unknown as { nome: string; catalogo_id: string | null; ordem: number }[]) ?? [])].sort((a, b) => a.ordem - b.ordem);
      // Categoria do histórico: a do primeiro serviço do catálogo (ou Estética)
      let categoria = "estetica";
      const comCatalogo = itens.find((i) => i.catalogo_id);
      if (comCatalogo) {
        const { data: c } = await supabase.from("catalogo_servicos").select("categoria").eq("id", comCatalogo.catalogo_id!).maybeSingle();
        if (c?.categoria) categoria = c.categoria;
      }
      const titulo = itens.map((i) => i.nome).join(", ").slice(0, 140) || `OS #${os.numero}`;
      const { data: h, error } = await supabase
        .from("servicos")
        .insert({
          veiculo_id: os.veiculo_id,
          data: os.data,
          categoria,
          titulo,
          descricao: `Ordem de serviço #${os.numero}`,
          km: os.km,
          valor: Number(os.total),
          prestador: "proprio",
        })
        .select("id")
        .single();
      if (error) console.error("[os] histórico", error);
      historicoId = h?.id ?? null;
    }
    await supabase.from("ordens_servico").update({ status: "entregue", entregue_em: agora, servico_historico_id: historicoId }).eq("id", id);
    if (os.agendamento_id) await supabase.from("agendamentos").update({ situacao: "concluido" }).eq("id", os.agendamento_id).eq("situacao", "confirmado");
    if (os.veiculo_id) {
      await notificar(
        [perfilId],
        { titulo: "Serviço registrado na sua garagem", corpo: `${carro ? `${carro}: ` : ""}o que fizemos hoje já está no histórico do veículo. Obrigado pela preferência!`, link: `/garagem/${os.veiculo_id}` },
        site,
      );
    }
  } else {
    await supabase.from("ordens_servico").update({ status: para }).eq("id", id);
  }

  revalidatePath("/gestao", "layout");
  return { sucesso: `OS #${os.numero}: ${STATUS_OS[para].rotulo.toLowerCase()}.` };
}

/**
 * Volta a OS uma etapa (ex.: marcou "pronta" sem querer).
 * - pronta → em andamento: os produtos voltam para o estoque (saem de novo ao marcar pronta).
 * - entregue → pronta: o serviço sai do histórico do veículo e o agendamento volta a "confirmado".
 */
export async function voltarStatus(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const id = texto(form, "id");
  const para = texto(form, "para") as StatusOS;
  const supabase = await createClient();
  const { data: os } = await supabase
    .from("ordens_servico")
    .select("id, numero, status, fatura_id, agendamento_id, servico_historico_id")
    .eq("id", id)
    .maybeSingle();
  if (!os) return { erro: "OS não encontrada." };
  const atual = os.status as StatusOS;
  if (STATUS_OS[atual].anterior !== para) return { erro: "Esta etapa não está disponível. Atualize a página." };
  if (os.fatura_id && (para === "em_andamento" || para === "aberta")) {
    return { erro: "Esta OS está numa fatura. Cancele a fatura antes de voltar a etapa." };
  }

  if (atual === "pronta") {
    const { error } = await supabase.rpc("gestao_estornar_estoque_os", { p_os: id });
    if (error) return { erro: "Não foi possível devolver os produtos ao estoque." };
    await supabase.from("ordens_servico").update({ status: para, pronta_em: null }).eq("id", id);
  } else if (atual === "entregue") {
    if (os.servico_historico_id) await supabase.from("servicos").delete().eq("id", os.servico_historico_id);
    await supabase.from("ordens_servico").update({ status: para, entregue_em: null, servico_historico_id: null }).eq("id", id);
    if (os.agendamento_id) await supabase.from("agendamentos").update({ situacao: "confirmado" }).eq("id", os.agendamento_id).eq("situacao", "concluido");
  } else {
    await supabase.from("ordens_servico").update({ status: para }).eq("id", id);
  }

  revalidatePath("/gestao", "layout");
  return { sucesso: `OS #${os.numero} voltou para “${STATUS_OS[para].rotulo}”.` };
}

export async function cancelarOS(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const id = texto(form, "id");
  const supabase = await createClient();
  const { data: os } = await supabase.from("ordens_servico").select("*").eq("id", id).maybeSingle();
  if (!os) return { erro: "OS não encontrada." };
  if (os.pago || Number(os.valor_pago ?? 0) > 0) return { erro: "Esta OS já tem pagamento registrado. Para devolver o dinheiro, lance uma saída no financeiro antes de cancelar." };
  if (os.fatura_id) return { erro: "Esta OS está em uma fatura. Cancele a fatura antes." };
  if (os.status === "entregue" || os.status === "cancelada") return { erro: "Não dá para cancelar esta OS." };
  const { error } = await supabase.rpc("gestao_estornar_estoque_os", { p_os: id });
  if (error) return { erro: "Não foi possível devolver os produtos ao estoque." };
  await supabase.from("ordens_servico").update({ status: "cancelada" }).eq("id", id);
  revalidatePath("/gestao", "layout");
  return { sucesso: `OS #${os.numero} cancelada. Os produtos voltaram para o estoque.` };
}

/** Recebe o pagamento de uma OS avulsa (cliente lojista vai para a fatura). */
/** Recebe um ou mais pagamentos de uma OS avulsa (cliente lojista vai para a fatura). */
export async function receberOS(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const id = texto(form, "id");
  const data = texto(form, "data") || hojeISO();
  if (!dataValida(data)) return { erro: "Data inválida." };
  let pagamentos: { valor: number; forma: string; conta_id: string | null; parcelas: number }[];
  try {
    pagamentos = JSON.parse(texto(form, "pagamentos") || "[]");
  } catch {
    return { erro: "Dados inválidos. Recarregue a página." };
  }
  if (!Array.isArray(pagamentos) || pagamentos.length === 0) return { erro: "Informe pelo menos um pagamento." };
  for (const p of pagamentos) {
    if (!(Number(p.valor) > 0)) return { erro: "Cada pagamento precisa de um valor." };
    if (!ehFormaPagamento(String(p.forma))) return { erro: "Escolha a forma de cada pagamento." };
    if (!p.conta_id) return { erro: "Escolha a conta de cada pagamento." };
    p.valor = arred(Number(p.valor));
    p.parcelas = p.forma === "credito" ? Math.min(24, Math.max(1, Math.round(Number(p.parcelas) || 1))) : 1;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("gestao_receber_os_pagamentos", { p_os: id, p_pagamentos: pagamentos, p_data: data });
  if (error) {
    console.error("[os] receber", error);
    if (error.code === "PGRST202") return { erro: "Falta atualizar o banco: rode o arquivo 0013_pagamentos_os.sql no Supabase (veja docs/GESTAO.md)." };
    const conhecido = ["lojista", "já foi", "não recebe", "não aceita", "somam mais", "Escolha a conta"].some((t) => error.message.includes(t));
    return { erro: conhecido ? error.message : "Não foi possível registrar o pagamento." };
  }
  revalidatePath("/gestao", "layout");
  return { sucesso: pagamentos.length > 1 ? `${pagamentos.length} pagamentos registrados no financeiro.` : "Pagamento registrado no financeiro." };
}
