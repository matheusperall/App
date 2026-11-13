/**
 * Textos prontos para mandar ao cliente pelo WhatsApp (ordem de serviço, orçamento e agendamento).
 * O *negrito* segue o padrão do WhatsApp.
 */
import { formatarQuando } from "@/lib/agenda";
import type { ItemOrcamento } from "@/lib/garagem";
import { STATUS_OS, arred, faltaReceber, rotuloForma, type OrdemServico, type PagamentoOS } from "@/lib/gestao";

export const EMPRESA = "Nexus Automotive";

export type Mensagem = { chave: string; rotulo: string; texto: string };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (d: string) => d.slice(0, 10).split("-").reverse().join("/");
const primeiroNome = (nome?: string | null) => (nome ?? "").trim().split(/\s+/)[0] ?? "";
const ola = (nome?: string | null) => (primeiroNome(nome) ? `Olá, ${primeiroNome(nome)}!` : "Olá!");
const juntar = (linhas: (string | false | null | undefined)[]) =>
  linhas
    .filter((l): l is string => typeof l === "string")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

function itensOS(os: OrdemServico) {
  return [
    ...os.itens.map((i) => `• ${i.nome}: ${brl(i.preco)}`),
    os.desconto > 0 ? `Desconto: −${brl(os.desconto)}` : null,
    `*Total: ${brl(os.total)}*`,
  ];
}
const veiculoOS = (os: OrdemServico) => [os.veiculo_nome, os.placa].filter(Boolean).join(" · ");

/** Mensagens da ordem de serviço, conforme a situação dela. A primeira é a sugerida. */
export function mensagensOS(os: OrdemServico, pagamentos: PagamentoOS[] = []): Mensagem[] {
  const falta = faltaReceber(os);
  const pago = arred(os.total - falta);
  const lista: Mensagem[] = [];

  const resumo: Mensagem = {
    chave: "resumo",
    rotulo: "Ordem de serviço",
    texto: juntar([
      ola(os.cliente?.nome),
      `Aqui é da *${EMPRESA}*. Segue a ordem de serviço do seu veículo:`,
      "",
      `*OS #${os.numero}* · ${dataBr(os.data)}`,
      veiculoOS(os),
      `Situação: ${STATUS_OS[os.status].rotulo}`,
      "",
      ...itensOS(os),
      os.observacoes ? `\nObs.: ${os.observacoes}` : null,
      "",
      "Qualquer dúvida, é só chamar por aqui.",
    ]),
  };

  const pronta: Mensagem = {
    chave: "pronta",
    rotulo: "Carro pronto",
    texto: juntar([
      ola(os.cliente?.nome),
      `Seu *${os.veiculo_nome ?? "veículo"}*${os.placa ? ` (${os.placa})` : ""} está *pronto* para retirada! 🚗✨`,
      "",
      `*OS #${os.numero}*`,
      ...itensOS(os),
      os.cliente?.lojista
        ? "\nO valor entra na fatura do mês."
        : falta > 0
          ? `\n${pago > 0 ? `Já pago: ${brl(pago)}\n` : ""}*A pagar na retirada: ${brl(falta)}*`
          : "\nPagamento já recebido. Obrigado!",
      "",
      `Te esperamos na *${EMPRESA}*.`,
    ]),
  };

  const cobranca: Mensagem = {
    chave: "cobranca",
    rotulo: "Cobrança",
    texto: juntar([
      ola(os.cliente?.nome),
      `Aqui é da *${EMPRESA}*. Passando para lembrar do valor em aberto da *OS #${os.numero}* (${dataBr(os.data)}):`,
      "",
      veiculoOS(os),
      ...os.itens.map((i) => `• ${i.nome}: ${brl(i.preco)}`),
      `Total: ${brl(os.total)}`,
      pago > 0 ? `Já pago: ${brl(pago)}` : null,
      `*Em aberto: ${brl(falta)}*`,
      "",
      "Pode pagar por Pix, cartão ou dinheiro. Se já pagou, por favor desconsidere e nos mande o comprovante. Obrigado!",
    ]),
  };

  const recebidos =
    pagamentos.length > 0
      ? pagamentos.map((p) => `• ${dataBr(p.data)} · ${rotuloForma(p.forma, p.parcelas)}: ${brl(p.valor)}`)
      : os.pago
        ? [`• ${os.pago_em ? dataBr(os.pago_em) : ""}${os.forma_pagamento ? ` · ${rotuloForma(os.forma_pagamento, os.parcelas)}` : ""}: ${brl(os.total)}`]
        : [];
  const comprovante: Mensagem = {
    chave: "comprovante",
    rotulo: "Comprovante de pagamento",
    texto: juntar([
      `*Comprovante de pagamento — ${EMPRESA}*`,
      "",
      `Cliente: ${os.cliente?.nome ?? ""}`,
      `OS #${os.numero} · ${dataBr(os.data)}`,
      veiculoOS(os),
      "",
      ...os.itens.map((i) => `• ${i.nome}: ${brl(i.preco)}`),
      os.desconto > 0 ? `Desconto: −${brl(os.desconto)}` : null,
      `Total da OS: ${brl(os.total)}`,
      "",
      "*Pagamentos recebidos*",
      ...recebidos,
      `*Total pago: ${brl(pago)}*`,
      falta > 0 ? `Falta pagar: ${brl(falta)}` : "✅ Quitado",
      "",
      "Obrigado pela preferência!",
    ]),
  };

  const concluida = os.status === "pronta" || os.status === "entregue";
  const temPagamento = pago > 0;
  const deveCobrar = concluida && falta > 0 && !os.cliente?.lojista;

  // Ordem: a mais útil para a situação atual vem primeiro
  if (os.status === "pronta") lista.push(pronta);
  if (os.status === "entregue" && deveCobrar) lista.push(cobranca);
  if (temPagamento && falta === 0) lista.push(comprovante);
  lista.push(resumo);
  if (deveCobrar && !lista.includes(cobranca)) lista.push(cobranca);
  if (temPagamento && !lista.includes(comprovante)) lista.push(comprovante);
  return os.status === "cancelada" ? [resumo] : lista;
}

/** Orçamento para enviar ao cliente. */
export function mensagemOrcamento(o: {
  numero: number;
  itens: ItemOrcamento[];
  valor_total: number | null;
  prazo_dias: number | null;
  validade: string | null;
  observacoes: string | null;
  cliente?: string | null;
  veiculo?: string | null;
  placa?: string | null;
}): Mensagem {
  const total = o.valor_total ?? o.itens.reduce((t, i) => t + i.valor, 0);
  return {
    chave: "orcamento",
    rotulo: "Orçamento",
    texto: juntar([
      ola(o.cliente),
      `Aqui é da *${EMPRESA}*. Segue o orçamento que você pediu:`,
      "",
      `*Orçamento #${o.numero}*`,
      [o.veiculo, o.placa].filter(Boolean).join(" · ") || null,
      "",
      ...o.itens.map((i) => `• ${i.descricao}: ${brl(i.valor)}`),
      `*Total: ${brl(total)}*`,
      "",
      o.prazo_dias != null ? `Prazo de execução: ${o.prazo_dias} ${o.prazo_dias === 1 ? "dia" : "dias"}` : null,
      o.validade ? `Válido até ${dataBr(o.validade)}` : null,
      o.observacoes ? `Obs.: ${o.observacoes}` : null,
      "",
      "Para aprovar, é só responder por aqui ou tocar em *Aprovar* no app. Qualquer dúvida, estamos à disposição!",
    ]),
  };
}

/** Lembrete de agendamento. */
export function mensagemLembreteAgendamento(a: { servico: string; inicio: string | null; fim: string | null; cliente?: string | null; veiculo?: string | null; placa?: string | null }): Mensagem {
  return {
    chave: "lembrete",
    rotulo: "Lembrete do agendamento",
    texto: juntar([
      ola(a.cliente),
      `Passando para lembrar do seu agendamento na *${EMPRESA}*:`,
      "",
      `📅 *${formatarQuando(a.inicio, a.fim)}*`,
      `🔧 ${a.servico}`,
      [a.veiculo, a.placa].filter(Boolean).join(" · ") ? `🚗 ${[a.veiculo, a.placa].filter(Boolean).join(" · ")}` : null,
      "",
      "Podemos confirmar? Se precisar remarcar, é só avisar por aqui.",
    ]),
  };
}
