/**
 * Mensagens de WhatsApp para o cliente (ordem de serviço, orçamento e agendamento).
 *
 * Cada tipo tem um MODELO com campos entre chaves, ex.: "Olá, {cliente}! Seu {marca} {modelo} está pronto."
 * Os campos são trocados pelos dados do cliente, do carro e da OS. A empresa pode editar os modelos
 * (Gestão › Mensagens); o que não for editado usa o texto padrão abaixo.
 * Regra: se um campo de uma linha ficar vazio, a linha inteira some (ex.: "Obs.: {observacoes}" sem observação).
 */
import { formatarQuando } from "@/lib/agenda";
import type { ItemOrcamento } from "@/lib/garagem";
import { STATUS_OS, arred, faltaReceber, rotuloForma, type OrdemServico, type PagamentoOS } from "@/lib/gestao";

export const EMPRESA = "Nexus Automotive";

export type Mensagem = { chave: ChaveMensagem; rotulo: string; texto: string };

/** Campos que podem ser usados nos modelos (com a explicação para a tela de edição). */
export const CAMPOS = {
  cliente: "Primeiro nome do cliente",
  cliente_completo: "Nome completo do cliente",
  empresa: "Nome da loja",
  marca: "Marca do carro",
  modelo: "Modelo do carro",
  ano: "Ano do carro",
  cor: "Cor do carro",
  placa: "Placa",
  numero: "Número da OS ou do orçamento",
  data: "Data da OS",
  situacao: "Situação da OS",
  servicos: "Lista de serviços com valores",
  desconto: "Desconto (some se não tiver)",
  total: "Valor total",
  pago: "Quanto já foi pago (some se nada)",
  em_aberto: "Quanto falta pagar",
  pagamento_retirada: "Valor a pagar na retirada (ou aviso de pago / fatura)",
  pagamentos: "Lista dos pagamentos recebidos",
  quitacao: "“✅ Quitado” ou quanto falta",
  itens: "Itens do orçamento com valores",
  prazo: "Prazo de execução",
  validade: "Validade do orçamento",
  observacoes: "Observações (some se não tiver)",
  quando: "Dia e horário do agendamento",
  servico: "Serviço agendado",
} as const;
export type Campo = keyof typeof CAMPOS;
type Valores = Partial<Record<Campo, string>>;

export const MODELOS = {
  os_resumo: {
    rotulo: "Ordem de serviço",
    onde: "Ordem de serviço",
    padrao: `Olá, {cliente}!
Aqui é da *{empresa}*. Segue a ordem de serviço do seu {marca} {modelo}:

*OS #{numero}* · {data}
{marca} {modelo} · {placa}
Situação: {situacao}

{servicos}
Desconto: −{desconto}
*Total: {total}*

Obs.: {observacoes}

Qualquer dúvida, é só chamar por aqui.`,
  },
  os_pronta: {
    rotulo: "Carro pronto",
    onde: "Ordem de serviço (quando fica pronta)",
    padrao: `Olá, {cliente}!
Seu *{marca} {modelo}* ({placa}) está *pronto* para retirada! 🚗✨

*OS #{numero}*
{servicos}
Desconto: −{desconto}
*Total: {total}*

{pagamento_retirada}

Te esperamos na *{empresa}*.`,
  },
  os_cobranca: {
    rotulo: "Cobrança",
    onde: "Ordem de serviço (com valor em aberto)",
    padrao: `Olá, {cliente}!
Aqui é da *{empresa}*. Passando para lembrar do valor em aberto da *OS #{numero}* ({data}), do seu {marca} {modelo} ({placa}):

{servicos}
Total: {total}
Já pago: {pago}
*Em aberto: {em_aberto}*

Pode pagar por Pix, cartão ou dinheiro. Se já pagou, por favor desconsidere e nos mande o comprovante. Obrigado!`,
  },
  os_comprovante: {
    rotulo: "Comprovante de pagamento",
    onde: "Ordem de serviço (depois de receber)",
    padrao: `*Comprovante de pagamento — {empresa}*

Cliente: {cliente_completo}
OS #{numero} · {data}
{marca} {modelo} · {placa}

{servicos}
Desconto: −{desconto}
Total da OS: {total}

*Pagamentos recebidos*
{pagamentos}
*Total pago: {pago}*
{quitacao}

Obrigado pela preferência, {cliente}!`,
  },
  orcamento: {
    rotulo: "Orçamento",
    onde: "Orçamento",
    padrao: `Olá, {cliente}!
Aqui é da *{empresa}*. Segue o orçamento para o seu {marca} {modelo}:

*Orçamento #{numero}*
{marca} {modelo} · {placa}

{itens}
*Total: {total}*

Prazo de execução: {prazo}
Válido até {validade}
Obs.: {observacoes}

Para aprovar, é só responder por aqui ou tocar em *Aprovar* no app. Qualquer dúvida, estamos à disposição!`,
  },
  orcamento_combinar: {
    rotulo: "Combinar a data",
    onde: "Orçamento (depois de aprovado)",
    padrao: `Olá, {cliente}! Aqui é da *{empresa}*.
Obrigado por aprovar o orçamento #{numero} ({total}).
Qual o melhor dia para trazer o seu {marca} {modelo}?`,
  },
  agendamento_lembrete: {
    rotulo: "Lembrete do agendamento",
    onde: "Agendamento (confirmado)",
    padrao: `Olá, {cliente}!
Passando para lembrar do seu agendamento na *{empresa}*:

📅 *{quando}*
🔧 {servico}
🚗 {marca} {modelo} · {placa}

Podemos confirmar? Se precisar remarcar, é só avisar por aqui.`,
  },
  agendamento_conversa: {
    rotulo: "Falar sobre o agendamento",
    onde: "Agendamento",
    padrao: `Olá, {cliente}! Aqui é da *{empresa}*, sobre o agendamento de {servico} do seu {marca} {modelo}.`,
  },
} as const;
export type ChaveMensagem = keyof typeof MODELOS;
export type ModelosSalvos = Partial<Record<ChaveMensagem, string>>;

export const ehChaveMensagem = (c: string): c is ChaveMensagem => c in MODELOS;

/** Troca os {campos} pelos valores. Linha com campo vazio some; espaços extras são limpos. */
export function preencher(modelo: string, valores: Valores): string {
  const linhas: string[] = [];
  for (const linha of modelo.split("\n")) {
    let vazio = false;
    const pronta = linha.replace(/\{([a-z_]+)\}/g, (inteiro, nome: string) => {
      if (!(nome in CAMPOS)) return inteiro;
      const v = valores[nome as Campo];
      if (v == null || v === "") {
        vazio = true;
        return "";
      }
      return v;
    });
    if (!vazio) linhas.push(pronta.replace(/[ \t]+$/g, ""));
  }
  return linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (d: string | null | undefined) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");
const primeiro = (nome?: string | null) => (nome ?? "").trim().split(/\s+/)[0] ?? "";

/** Dados do carro e do cliente usados em todas as mensagens. */
export type DadosCliente = {
  nome?: string | null;
  marca?: string | null;
  modelo?: string | null;
  ano?: number | null;
  cor?: string | null;
  placa?: string | null;
};
function basicos(c: DadosCliente): Valores {
  return {
    cliente: primeiro(c.nome),
    cliente_completo: (c.nome ?? "").trim(),
    empresa: EMPRESA,
    marca: c.marca ?? "",
    modelo: c.modelo ?? "",
    ano: c.ano ? String(c.ano) : "",
    cor: c.cor ?? "",
    placa: c.placa ?? "",
  };
}

const gerar = (chave: ChaveMensagem, valores: Valores, salvos: ModelosSalvos): Mensagem => ({
  chave,
  rotulo: MODELOS[chave].rotulo,
  texto: preencher(salvos[chave]?.trim() || MODELOS[chave].padrao, valores),
});

/** Mensagens da ordem de serviço, conforme a situação dela. A primeira é a sugerida. */
export function mensagensOS(os: OrdemServico, pagamentos: PagamentoOS[], cliente: DadosCliente, salvos: ModelosSalvos = {}): Mensagem[] {
  const falta = faltaReceber(os);
  const pago = arred(os.total - falta);
  const recebidos =
    pagamentos.length > 0
      ? pagamentos.map((p) => `• ${dataBr(p.data)} · ${rotuloForma(p.forma, p.parcelas)}: ${brl(p.valor)}`)
      : os.pago
        ? [`• ${dataBr(os.pago_em)}${os.forma_pagamento ? ` · ${rotuloForma(os.forma_pagamento, os.parcelas)}` : ""}: ${brl(os.total)}`]
        : [];
  const valores: Valores = {
    ...basicos({ ...cliente, nome: cliente.nome ?? os.cliente?.nome, placa: cliente.placa ?? os.placa }),
    numero: String(os.numero),
    data: dataBr(os.data),
    situacao: STATUS_OS[os.status].rotulo,
    servicos: os.itens.map((i) => `• ${i.nome}: ${brl(i.preco)}`).join("\n"),
    desconto: os.desconto > 0 ? brl(os.desconto) : "",
    total: brl(os.total),
    pago: pago > 0 ? brl(pago) : "",
    em_aberto: brl(falta),
    pagamento_retirada: os.cliente?.lojista
      ? "O valor entra na fatura do mês."
      : falta > 0
        ? `${pago > 0 ? `Já pago: ${brl(pago)}\n` : ""}*A pagar na retirada: ${brl(falta)}*`
        : "Pagamento já recebido. Obrigado!",
    pagamentos: recebidos.join("\n"),
    quitacao: falta > 0 ? `Falta pagar: ${brl(falta)}` : "✅ Quitado",
    observacoes: os.observacoes ?? "",
  };
  if (!cliente.marca && !cliente.modelo) valores.marca = os.veiculo_nome ?? "veículo";

  const concluida = os.status === "pronta" || os.status === "entregue";
  const deveCobrar = concluida && falta > 0 && !os.cliente?.lojista;
  const ordem: ChaveMensagem[] = [];
  if (os.status === "cancelada") ordem.push("os_resumo");
  else {
    if (os.status === "pronta") ordem.push("os_pronta");
    if (os.status === "entregue" && deveCobrar) ordem.push("os_cobranca");
    if (pago > 0 && falta === 0) ordem.push("os_comprovante");
    ordem.push("os_resumo");
    if (deveCobrar && !ordem.includes("os_cobranca")) ordem.push("os_cobranca");
    if (pago > 0 && !ordem.includes("os_comprovante")) ordem.push("os_comprovante");
  }
  return ordem.map((c) => gerar(c, valores, salvos));
}

/** Orçamento (e, depois de aprovado, "combinar a data"). */
export function mensagensOrcamento(
  o: { numero: number; itens: ItemOrcamento[]; valor_total: number | null; prazo_dias: number | null; validade: string | null; observacoes: string | null; situacao: string },
  cliente: DadosCliente,
  salvos: ModelosSalvos = {},
): Mensagem[] {
  const total = o.valor_total ?? o.itens.reduce((t, i) => t + i.valor, 0);
  const valores: Valores = {
    ...basicos(cliente),
    numero: String(o.numero),
    itens: o.itens.map((i) => `• ${i.descricao}: ${brl(i.valor)}`).join("\n"),
    total: brl(total),
    prazo: o.prazo_dias != null ? `${o.prazo_dias} ${o.prazo_dias === 1 ? "dia" : "dias"}` : "",
    validade: dataBr(o.validade),
    observacoes: o.observacoes ?? "",
  };
  const ordem: ChaveMensagem[] = o.situacao === "aceito" ? ["orcamento_combinar", "orcamento"] : ["orcamento"];
  return ordem.map((c) => gerar(c, valores, salvos));
}

/** Agendamento: lembrete (se confirmado com horário) e conversa. */
export function mensagensAgendamento(
  a: { servico: string; inicio: string | null; fim: string | null; situacao: string },
  cliente: DadosCliente,
  salvos: ModelosSalvos = {},
): Mensagem[] {
  const valores: Valores = { ...basicos(cliente), servico: a.servico, quando: a.inicio ? formatarQuando(a.inicio, a.fim) : "" };
  const ordem: ChaveMensagem[] = a.situacao === "confirmado" && a.inicio ? ["agendamento_lembrete", "agendamento_conversa"] : ["agendamento_conversa"];
  return ordem.map((c) => gerar(c, valores, salvos));
}

/** Exemplo de valores para a pré-visualização na tela de edição dos modelos. */
export const EXEMPLO: Valores = {
  ...basicos({ nome: "Maria Souza", marca: "Honda", modelo: "Civic EXL", ano: 2021, cor: "Prata", placa: "BRA2E19" }),
  numero: "125",
  data: "13/11/2026",
  situacao: "Pronta",
  servicos: "• Lavagem completa: R$ 80,00\n• Enceramento: R$ 120,00",
  desconto: "",
  total: "R$ 200,00",
  pago: "R$ 50,00",
  em_aberto: "R$ 150,00",
  pagamento_retirada: "Já pago: R$ 50,00\n*A pagar na retirada: R$ 150,00*",
  pagamentos: "• 13/11/2026 · Pix: R$ 50,00",
  quitacao: "Falta pagar: R$ 150,00",
  itens: "• Polimento técnico: R$ 650,00",
  prazo: "2 dias",
  validade: "28/11/2026",
  observacoes: "",
  quando: "Segunda-feira, 16 de novembro, 09:00",
  servico: "Lavagem completa",
};
