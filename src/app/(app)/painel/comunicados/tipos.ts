export const TIPOS_COMUNICADO = {
  novidade: { rotulo: "Novidade", icone: "✨" },
  promocao: { rotulo: "Promoção", icone: "🏷️" },
  lembrete: { rotulo: "Lembrete", icone: "⏰" },
  oportunidade: { rotulo: "Oportunidade", icone: "💡" },
} as const;
export type TipoComunicado = keyof typeof TIPOS_COMUNICADO;

/** Para onde o cliente vai ao tocar no aviso */
export const DESTINOS = [
  ["", "Só abrir o aviso"],
  ["/agendamentos/novo", "Agendar (lavagem ou serviço)"],
  ["/orcamentos/novo", "Pedir orçamento"],
  ["/garagem", "Minha garagem"],
  ["outro", "Link externo (Instagram, site…)"],
] as const;
