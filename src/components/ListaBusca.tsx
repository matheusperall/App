"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { combina } from "@/lib/gestao";

export type OpcaoBusca = {
  id: string;
  titulo: string;
  /** Linha menor embaixo (telefone, placa…) */
  detalhe?: string;
  /** Texto à direita (preço, placa…) */
  extra?: ReactNode;
  /** Texto extra usado só na busca (ex.: placas sem traço) */
  busca?: string;
};

/**
 * Campo de busca com menu flutuante: começa em branco; ao digitar, mostra as opções que combinam.
 * A setinha ▾ abre a lista completa para escolher sem digitar.
 */
export function ListaBusca({
  opcoes,
  aoEscolher,
  placeholder = "Digite para buscar",
  rotuloAcessivel,
  vazio = "Nada encontrado.",
  rodape,
  autoFocus,
  limite = 30,
}: {
  opcoes: OpcaoBusca[];
  aoEscolher: (id: string) => void;
  placeholder?: string;
  rotuloAcessivel: string;
  vazio?: string;
  /** Ação no fim do menu (ex.: "+ Cadastrar novo cliente"). Recebe o texto digitado. */
  rodape?: (texto: string, fechar: () => void) => ReactNode;
  autoFocus?: boolean;
  limite?: number;
}) {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  const idLista = useId();

  const filtradas = useMemo(() => {
    const t = texto.trim();
    // Placas: aceita digitar com ou sem traço
    const semSimbolos = t.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const lista = t
      ? opcoes.filter(
          (o) =>
            combina(`${o.titulo} ${o.detalhe ?? ""} ${o.busca ?? ""}`, t) ||
            (semSimbolos.length >= 3 && (o.busca ?? "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").includes(semSimbolos)),
        )
      : opcoes;
    return lista.slice(0, limite);
  }, [texto, opcoes, limite]);

  // Fecha ao tocar fora
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  function escolher(id: string) {
    aoEscolher(id);
    setTexto("");
    setAberto(false);
  }

  return (
    <div ref={caixa} className="relative">
      <div className="flex gap-2">
        <input
          type="search"
          role="combobox"
          aria-expanded={aberto}
          aria-controls={idLista}
          aria-label={rotuloAcessivel}
          autoComplete="off"
          autoFocus={autoFocus}
          className="campo"
          placeholder={placeholder}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAberto(e.target.value.trim().length > 0);
            setAtivo(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setAberto(false);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAberto(true);
              setAtivo((a) => Math.min(a + 1, filtradas.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setAtivo((a) => Math.max(a - 1, 0));
            }
            if (e.key === "Enter" && aberto && filtradas[ativo]) {
              e.preventDefault();
              escolher(filtradas[ativo].id);
            }
          }}
        />
        <button
          type="button"
          className="botao-contorno shrink-0 px-3.5"
          aria-label={aberto ? "Fechar lista" : "Abrir lista para escolher"}
          onClick={() => {
            setAberto((a) => !a);
            setAtivo(0);
          }}
        >
          <svg viewBox="0 0 24 24" className={`h-5 w-5 transition ${aberto ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      {aberto && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-borda bg-white shadow-xl shadow-tinta/10">
          <ul id={idLista} role="listbox" className="max-h-72 divide-y divide-borda overflow-y-auto">
            {filtradas.map((o, i) => (
              <li key={o.id} role="option" aria-selected={i === ativo}>
                <button
                  type="button"
                  onMouseEnter={() => setAtivo(i)}
                  onClick={() => escolher(o.id)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${i === ativo ? "bg-fundo" : "hover:bg-fundo"}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{o.titulo}</span>
                    {o.detalhe && <span className="block truncate text-xs text-suave">{o.detalhe}</span>}
                  </span>
                  {o.extra && <span className="shrink-0 text-sm">{o.extra}</span>}
                </button>
              </li>
            ))}
            {filtradas.length === 0 && <li className="px-4 py-3 text-sm text-suave">{vazio}</li>}
          </ul>
          {rodape && <div className="border-t border-borda bg-fundo/60 p-2">{rodape(texto.trim(), () => setAberto(false))}</div>}
        </div>
      )}
    </div>
  );
}

/**
 * Campo de formulário com busca: mostra o item escolhido (com "Trocar") ou a busca com menu flutuante.
 * Envia o id escolhido no `nome` e não deixa enviar o formulário vazio.
 */
export function CampoEscolha({
  rotulo,
  nome,
  opcoes,
  valor,
  mudar,
  placeholder,
  vazio,
  rodape,
}: {
  rotulo: string;
  nome: string;
  opcoes: OpcaoBusca[];
  valor: string;
  mudar: (id: string) => void;
  placeholder?: string;
  vazio?: string;
  rodape?: (texto: string, fechar: () => void) => ReactNode;
}) {
  const escolhido = opcoes.find((o) => o.id === valor);
  return (
    <div className="relative space-y-1.5">
      <span className="block text-sm font-medium text-texto">
        {rotulo}
        <span className="ml-0.5 text-perigo" aria-hidden="true">*</span>
      </span>
      {/* Campo invisível só para o navegador avisar se ficar vazio */}
      <input name={nome} value={valor} required onChange={() => {}} tabIndex={-1} aria-hidden="true" className="pointer-events-none absolute h-px w-px opacity-0" />
      {escolhido ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-marca/40 bg-marca-clara/50 px-4 py-2.5">
          <span className="min-w-0">
            <span className="block truncate font-medium">{escolhido.titulo}</span>
            {escolhido.detalhe && <span className="block truncate text-sm text-suave">{escolhido.detalhe}</span>}
          </span>
          <span className="flex shrink-0 items-center gap-3">
            {escolhido.extra}
            <button type="button" onClick={() => mudar("")} className="text-sm font-semibold text-marca-escura hover:underline">
              Trocar
            </button>
          </span>
        </div>
      ) : (
        <ListaBusca opcoes={opcoes} aoEscolher={mudar} placeholder={placeholder} rotuloAcessivel={rotulo} vazio={vazio} rodape={rodape} />
      )}
    </div>
  );
}
