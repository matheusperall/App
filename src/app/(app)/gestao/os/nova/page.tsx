import type { Metadata } from "next";
import { PaginaFicha } from "@/components/PaginaFicha";
import { Aviso } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { placaConfigurada } from "@/lib/consulta-placa";
import { obterAgendamento, obterOrcamento } from "@/lib/dados";
import { formatarQuando } from "@/lib/agenda";
import { hojeISO } from "@/lib/garagem";
import { combina } from "@/lib/gestao";
import { obterFicha } from "@/lib/gestao-dados";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { FormOS, type InicialOS } from "../FormOS";
import { opcoesFormOS } from "../opcoes";

export const metadata: Metadata = { title: "Nova OS" };

/** Ficha do veículo (cliente da loja) — usada ao abrir OS a partir de agendamento ou orçamento. */
async function fichaDoVeiculo(veiculoId: string): Promise<string | null> {
  if (!isSupabaseConfigured) return "demo-ficha";
  const supabase = await createClient();
  const { data } = await supabase.from("veiculos").select("cliente_id").eq("id", veiculoId).maybeSingle();
  return (data?.cliente_id as string | undefined) ?? null;
}

export default async function NovaOSPage({ searchParams }: PageProps<"/gestao/os/nova">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const { clientes, catalogo } = await opcoesFormOS();
  const inicial: InicialOS = { data: hojeISO() };
  let origem = "";

  const doCatalogo = (nome: string, preco: number | null) => {
    const s = catalogo.find((c) => combina(c.nome, nome) || combina(nome, c.nome));
    return s ? { catalogo_id: s.id, nome: s.nome, preco: preco ?? s.preco } : { catalogo_id: null, nome, preco: preco ?? 0 };
  };

  if (typeof sp.agendamento === "string") {
    const ag = await obterAgendamento(sp.agendamento);
    if (ag) {
      inicial.agendamento_id = ag.id;
      inicial.veiculoId = ag.veiculo_id;
      inicial.clienteId = await fichaDoVeiculo(ag.veiculo_id);
      // Veio de um orçamento aprovado: usa os itens e valores do orçamento; senão, o serviço do agendamento
      const orc = ag.orcamento_id ? await obterOrcamento(ag.orcamento_id) : null;
      inicial.itens = orc?.itens.length ? orc.itens.map((i) => doCatalogo(i.descricao, i.valor)) : [doCatalogo(ag.servico, null)];
      if (ag.orcamento_id) inicial.orcamento_id = ag.orcamento_id;
      inicial.observacoes = [ag.observacoes && `Cliente: ${ag.observacoes}`, ag.resposta && `Agendamento: ${ag.resposta}`, orc?.observacoes && `Orçamento: ${orc.observacoes}`]
        .filter(Boolean)
        .join("\n") || null;
      const quando = ag.inicio ? ` · ${formatarQuando(ag.inicio, ag.fim)}` : "";
      origem = `Agendamento: ${ag.servico}${quando}${orc ? ` (orçamento #${orc.numero})` : ""}`;
    }
  } else if (typeof sp.orcamento === "string") {
    const o = await obterOrcamento(sp.orcamento);
    if (o) {
      inicial.orcamento_id = o.id;
      inicial.veiculoId = o.veiculo_id;
      inicial.clienteId = await fichaDoVeiculo(o.veiculo_id);
      inicial.itens = o.itens.map((i) => doCatalogo(i.descricao, i.valor));
      if (o.observacoes) inicial.observacoes = `Orçamento: ${o.observacoes}`;
      origem = `Orçamento #${o.numero} aceito`;
    }
  } else if (typeof sp.cliente === "string") {
    const f = await obterFicha(sp.cliente);
    if (f) {
      inicial.clienteId = f.id;
      if (f.veiculos.length === 1) inicial.veiculoId = f.veiculos[0].id;
    }
  }

  return (
    <PaginaFicha voltar={{ href: "/gestao/os", rotulo: "Ordens de serviço" }} icone="os" titulo="Nova OS" descricao="Cliente, veículo e serviços. O total aparece na hora.">
      {origem && <Aviso>{origem}. Confira os serviços e os preços antes de abrir.</Aviso>}
      <FormOS key={JSON.stringify(sp)} clientes={clientes} catalogo={catalogo} inicial={inicial} placaApi={placaConfigurada()} />
    </PaginaFicha>
  );
}
