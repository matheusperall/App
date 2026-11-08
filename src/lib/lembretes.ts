import "server-only";
import {
  TIPOS_DOCUMENTO,
  diasEntre,
  formatarData,
  hojeISO,
  nomeVeiculo,
  rotuloManutencao,
  type TipoDocumento,
} from "@/lib/garagem";
import { notificar, notificarEmpresa } from "@/lib/notificar";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lembretes automáticos (roda uma vez por dia).
 *
 * Manutenções: avisa 30 dias antes, 7 dias antes, no dia, e uma vez por mês enquanto estiver vencida.
 *              Pela quilometragem: quando faltar 1.000 km e quando passar do km.
 * Documentos:  avisa 30, 7 e 1 dia antes, no dia, e uma vez por mês enquanto estiver vencido.
 * Hodômetro:   uma vez por mês pede para atualizar a quilometragem se ela está há mais de 45 dias sem atualizar
 *              (os lembretes por km dependem disso).
 *
 * Cada aviso tem uma "chave" registrada em lembretes_enviados, para nunca repetir o mesmo aviso.
 */

type Item = { chave: string; usuarioId: string; titulo: string; corpo: string; link: string };

function etapaPorData(dias: number, marcos: number[]): string | null {
  if (dias < 0) return `vencido-${Math.floor(-dias / 30)}`; // repete a cada 30 dias de atraso
  if (dias === 0) return "hoje";
  const marco = [...marcos].sort((a, b) => a - b).find((m) => dias <= m);
  return marco != null ? `d${marco}` : null;
}

function prazoTexto(dias: number) {
  if (dias === -1) return "venceu ontem";
  if (dias < 0) return `venceu há ${-dias} dias`;
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `vence em ${dias} dias`;
}

export async function processarLembretes(siteUrl: string, hoje = hojeISO()) {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");

  const itens: Item[] = [];

  // ---------------- Manutenções ----------------
  const { data: manutencoes } = await admin
    .from("manutencoes")
    .select("id, tipo, proxima_data, proximo_km, veiculo:veiculos (id, dono_id, placa, marca, modelo, apelido, km_atual)");

  for (const m of (manutencoes ?? []) as unknown as {
    id: string;
    tipo: string;
    proxima_data: string | null;
    proximo_km: number | null;
    veiculo: { id: string; dono_id: string; placa: string; marca: string; modelo: string; apelido: string | null; km_atual: number } | null;
  }[]) {
    const v = m.veiculo;
    if (!v) continue;
    const nome = rotuloManutencao(m.tipo);
    const carro = nomeVeiculo(v);
    const link = `/garagem/${v.id}`;

    // Pela data
    if (m.proxima_data) {
      const dias = diasEntre(hoje, m.proxima_data);
      const etapa = etapaPorData(dias, [7, 30]);
      if (etapa) {
        itens.push({
          chave: `m:${m.id}:${m.proxima_data}:${etapa}`,
          usuarioId: v.dono_id,
          titulo: `${dias < 0 ? "⚠️ " : ""}${nome}: ${prazoTexto(dias)}`,
          corpo: `${carro} (${v.placa}) — previsto para ${formatarData(m.proxima_data)}. Agende pelo app.`,
          link,
        });
        continue; // um aviso por manutenção por dia
      }
    }
    // Pela quilometragem
    if (m.proximo_km != null) {
      const falta = m.proximo_km - v.km_atual;
      const etapa = falta <= 0 ? "km-passou" : falta <= 1000 ? "km-breve" : null;
      if (etapa) {
        itens.push({
          chave: `m:${m.id}:${m.proximo_km}:${etapa}`,
          usuarioId: v.dono_id,
          titulo: `${falta <= 0 ? "⚠️ " : ""}${nome}: ${falta <= 0 ? "quilometragem atingida" : `faltam ${falta.toLocaleString("pt-BR")} km`}`,
          corpo: `${carro} (${v.placa}) — previsto para ${m.proximo_km.toLocaleString("pt-BR")} km. Agende pelo app.`,
          link,
        });
      }
    }
  }

  // ---------------- Documentos ----------------
  const { data: documentos } = await admin
    .from("documentos")
    .select("id, dono_id, tipo, descricao, vencimento, veiculo:veiculos (id, placa, marca, modelo, apelido)");

  for (const d of (documentos ?? []) as unknown as {
    id: string;
    dono_id: string;
    tipo: TipoDocumento;
    descricao: string | null;
    vencimento: string;
    veiculo: { id: string; placa: string; marca: string; modelo: string; apelido: string | null } | null;
  }[]) {
    const dias = diasEntre(hoje, d.vencimento);
    const etapa = etapaPorData(dias, [1, 7, 30]);
    if (!etapa) continue;
    const tipo = TIPOS_DOCUMENTO[d.tipo]?.rotulo ?? "Documento";
    const titulo = d.tipo === "outro" && d.descricao ? d.descricao : tipo;
    itens.push({
      chave: `d:${d.id}:${d.vencimento}:${etapa}`,
      usuarioId: d.dono_id,
      titulo: `${dias < 0 ? "⚠️ " : ""}${titulo}: ${prazoTexto(dias)}`,
      corpo: `${d.veiculo ? `${nomeVeiculo(d.veiculo)} (${d.veiculo.placa}) — ` : ""}vencimento em ${formatarData(d.vencimento)}.`,
      link: d.veiculo ? `/garagem/${d.veiculo.id}/documentos` : "/conta",
    });
  }

  // ---------------- Hodômetro desatualizado ----------------
  const comKm = new Set(
    ((manutencoes ?? []) as unknown as { proximo_km: number | null; veiculo: { id: string } | null }[])
      .filter((m) => m.proximo_km != null && m.veiculo)
      .map((m) => m.veiculo!.id),
  );
  if (comKm.size) {
    const { data: veiculos } = await admin
      .from("veiculos")
      .select("id, dono_id, placa, marca, modelo, apelido, km_atualizado_em")
      .in("id", [...comKm]);
    for (const v of veiculos ?? []) {
      if (diasEntre(v.km_atualizado_em.slice(0, 10), hoje) < 45) continue;
      itens.push({
        chave: `km:${v.id}:${hoje.slice(0, 7)}`,
        usuarioId: v.dono_id,
        titulo: "Atualize a quilometragem 🚗",
        corpo: `Informe o km atual do ${nomeVeiculo(v)} (${v.placa}) para mantermos seus lembretes de manutenção em dia.`,
        link: `/garagem/${v.id}`,
      });
    }
  }

  // ---------------- Remove os já enviados ----------------
  const chaves = itens.map((i) => i.chave);
  const jaEnviadas = new Set<string>();
  for (let i = 0; i < chaves.length; i += 100) {
    const { data } = await admin.from("lembretes_enviados").select("chave").in("chave", chaves.slice(i, i + 100));
    data?.forEach((d) => jaEnviadas.add(d.chave));
  }
  const novos = itens.filter((i) => !jaEnviadas.has(i.chave));

  // ---------------- Envia, um aviso por pessoa ----------------
  const porUsuario = new Map<string, Item[]>();
  for (const i of novos) porUsuario.set(i.usuarioId, [...(porUsuario.get(i.usuarioId) ?? []), i]);

  for (const [usuarioId, lista] of porUsuario) {
    const aviso =
      lista.length === 1
        ? { titulo: lista[0].titulo, corpo: lista[0].corpo, link: lista[0].link }
        : {
            titulo: `Você tem ${lista.length} lembretes do seu veículo`,
            corpo: lista.map((i) => i.titulo.replace("⚠️ ", "")).join(" · "),
            link: "/garagem",
          };
    await notificar([usuarioId], aviso, siteUrl);
    await admin
      .from("lembretes_enviados")
      .upsert(lista.map((i) => ({ chave: i.chave, usuario_id: usuarioId })), { onConflict: "chave", ignoreDuplicates: true });
  }

  // Resumo para a empresa (oportunidades de contato)
  const clientes = porUsuario.size;
  if (clientes > 0) {
    await notificarEmpresa(
      {
        titulo: `Lembretes de hoje: ${novos.length} para ${clientes} ${clientes === 1 ? "cliente" : "clientes"}`,
        corpo: "Veja no Painel quem está com manutenção ou documento vencendo — boa hora para entrar em contato.",
        link: "/painel#vencimentos",
      },
      siteUrl,
    );
  }

  return { verificados: itens.length, enviados: novos.length, clientes };
}
