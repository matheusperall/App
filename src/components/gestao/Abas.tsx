"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icone, type NomeIcone } from "./Icones";

const ABAS: { href: string; rotulo: string; icone: NomeIcone }[] = [
  { href: "/gestao", rotulo: "Painel", icone: "inicio" },
  { href: "/gestao/os", rotulo: "Ordens de serviço", icone: "os" },
  { href: "/gestao/faturas", rotulo: "Faturas", icone: "faturas" },
  { href: "/gestao/financeiro", rotulo: "Financeiro", icone: "financeiro" },
  { href: "/gestao/estoque", rotulo: "Estoque", icone: "estoque" },
  { href: "/gestao/catalogo", rotulo: "Serviços", icone: "servicos" },
  { href: "/gestao/clientes", rotulo: "Clientes", icone: "clientes" },
];

/** Menu da Gestão: uma barra com ícones, logo abaixo do topo do app. */
export function AbasGestao() {
  const path = usePathname();
  const ativa = (href: string) => (href === "/gestao" ? path === href : path === href || path.startsWith(`${href}/`));
  return (
    <nav aria-label="Gestão" className="-mx-4 border-y border-borda bg-white sm:mx-0 sm:rounded-2xl sm:border">
      <ul className="flex gap-1 overflow-x-auto px-3 sm:px-5">
        {ABAS.map((a) => (
          <li key={a.href} className="shrink-0">
            <Link
              href={a.href}
              aria-current={ativa(a.href) ? "page" : undefined}
              className={`flex items-center gap-1.5 border-b-2 px-2.5 py-3 text-sm font-medium transition ${
                ativa(a.href) ? "border-marca text-marca-escura" : "border-transparent text-suave hover:text-texto"
              }`}
            >
              <Icone nome={a.icone} className="h-4 w-4" />
              {a.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
