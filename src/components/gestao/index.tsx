import Link from "next/link";
import type { ReactNode } from "react";
import { formatarValor } from "@/lib/garagem";
import { STATUS_OS, nomeMes, somarMes, situacaoFatura, situacaoProduto, type Fatura, type Produto, type StatusOS } from "@/lib/gestao";

export function SeloStatus({ status }: { status: StatusOS }) {
  const s = STATUS_OS[status];
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.classe}`}>{s.rotulo}</span>;
}

export function SeloFatura({ f }: { f: Pick<Fatura, "situacao" | "vencimento"> }) {
  const s = situacaoFatura(f);
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.classe}`}>{s.rotulo}</span>;
}

export function SeloProduto({ p }: { p: Pick<Produto, "saldo" | "minimo"> }) {
  const s = situacaoProduto(p);
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.classe}`}>{s.rotulo}</span>;
}

export function Selo({ children, classe = "bg-fundo text-suave" }: { children: ReactNode; classe?: string }) {
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${classe}`}>{children}</span>;
}

/** Valor em reais, com sinal colorido opcional. */
export function Dinheiro({ valor, sinal = false, className = "" }: { valor: number; sinal?: boolean; className?: string }) {
  const cor = sinal ? (valor < 0 ? "text-perigo" : valor > 0 ? "text-sucesso" : "") : "";
  return <span className={`tabular-nums ${cor} ${className}`}>{formatarValor(valor)}</span>;
}

export function Indicador({ rotulo, valor, detalhe, href, destaque = false, compacto = false }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; href?: string; destaque?: boolean; compacto?: boolean }) {
  const conteudo = (
    <>
      <p className="text-sm text-suave">{rotulo}</p>
      <p className={`mt-1 font-titulo font-bold tabular-nums break-words ${compacto ? "text-base sm:text-2xl" : "text-xl sm:text-[1.7rem]"} ${destaque ? "text-marca-escura" : ""}`}>{valor}</p>
      {detalhe && <div className="mt-1 text-xs text-suave">{detalhe}</div>}
    </>
  );
  const classe = `block min-w-0 rounded-2xl border bg-white ${compacto ? "p-3 sm:p-5" : "p-4 sm:p-5"} ${destaque ? "border-marca/50" : "border-borda"}`;
  return href ? (
    <Link href={href} className={`${classe} transition hover:border-marca/60`}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

/** ‹ Novembro de 2026 › — navega entre os meses mantendo os outros filtros. */
export function NavMes({ mes, base, params = {} }: { mes: string; base: string; params?: Record<string, string | undefined> }) {
  const url = (m: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    q.set("mes", m);
    return `${base}?${q}`;
  };
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-borda bg-white p-1">
      <Link href={url(somarMes(mes, -1))} className="rounded-lg px-3 py-2 text-lg leading-none text-suave hover:bg-fundo hover:text-texto" aria-label="Mês anterior">‹</Link>
      <span className="text-sm font-semibold">{nomeMes(mes)}</span>
      <Link href={url(somarMes(mes, 1))} className="rounded-lg px-3 py-2 text-lg leading-none text-suave hover:bg-fundo hover:text-texto" aria-label="Próximo mês">›</Link>
    </div>
  );
}

export function Titulo({ pre, titulo, children }: { pre?: string; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {pre && <p className="text-suave">{pre}</p>}
        <h1 className="text-2xl font-bold sm:text-3xl">{titulo}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="px-5 py-6 text-center text-sm text-suave">{children}</p>;
}
