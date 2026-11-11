"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/gestao", rotulo: "Início" },
  { href: "/gestao/os", rotulo: "OS" },
  { href: "/gestao/faturas", rotulo: "Faturas" },
  { href: "/gestao/financeiro", rotulo: "Financeiro" },
  { href: "/gestao/estoque", rotulo: "Estoque" },
  { href: "/gestao/catalogo", rotulo: "Serviços" },
  { href: "/gestao/clientes", rotulo: "Clientes" },
];

export function AbasGestao() {
  const path = usePathname();
  const ativa = (href: string) => (href === "/gestao" ? path === href : path === href || path.startsWith(`${href}/`));
  return (
    <nav aria-label="Gestão" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 rounded-xl border border-borda bg-white p-1">
        {ABAS.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              aria-current={ativa(a.href) ? "page" : undefined}
              className={`block rounded-lg px-3 py-2 text-sm font-semibold transition ${ativa(a.href) ? "bg-tinta text-white" : "text-suave hover:text-texto"}`}
            >
              {a.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
