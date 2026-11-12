"use client";

import { useState, type InputHTMLAttributes } from "react";

/** Centavos → "1.234,56" */
export const formatarCentavos = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const paraCentavos = (v: number | null | undefined) => Math.round((v ?? 0) * 100);
/** Só os dígitos digitados viram centavos: "12345" → 12345 centavos = 123,45 */
const lerDigitos = (texto: string) => Math.min(Number.parseInt(texto.replace(/\D/g, "") || "0", 10), 99_999_999_999);

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type"> & {
  /** Valor inicial em reais (campo não controlado) */
  valorInicial?: number | null;
  /** Valor em reais (campo controlado) */
  valor?: number;
  aoMudar?: (reais: number) => void;
};

/**
 * Campo de valor em reais: começa em 0,00 e os números "correm" da direita para a esquerda,
 * como numa maquininha. Digitar 12345 resulta em 123,45.
 * O valor enviado no formulário fica no formato "1.234,56" (o servidor já entende).
 */
export function CampoDinheiro({ valorInicial, valor, aoMudar, className = "campo", ...resto }: Props) {
  const [interno, setInterno] = useState(paraCentavos(valorInicial));
  const centavos = valor !== undefined ? paraCentavos(valor) : interno;

  return (
    <input
      {...resto}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={`${className} text-right tabular-nums`}
      value={formatarCentavos(centavos)}
      onChange={(e) => {
        const c = lerDigitos(e.target.value);
        if (valor === undefined) setInterno(c);
        aoMudar?.(c / 100);
      }}
      onKeyDown={(e) => {
        // Apagar tira o último dígito, mesmo com o cursor no meio do texto
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          const c = Math.floor(centavos / 10);
          if (valor === undefined) setInterno(c);
          aoMudar?.(c / 100);
        }
      }}
      onFocus={(e) => {
        const alvo = e.currentTarget;
        requestAnimationFrame(() => alvo.setSelectionRange(alvo.value.length, alvo.value.length));
        resto.onFocus?.(e);
      }}
    />
  );
}
