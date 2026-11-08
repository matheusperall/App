import type { Metadata } from "next";
import Link from "next/link";
import { Placa, SeloPrioridade } from "@/components/garagem";
import { Aviso, Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { caixaDeEntrada, contarPainel } from "@/lib/dados";
import { SITUACOES_APONTAMENTO, formatarDataHora, nomeVeiculo } from "@/lib/garagem";
import { emailConfigurado, pushConfigurado } from "@/lib/notificar";

export const metadata: Metadata = { title: "Painel da empresa" };

export default async function PainelPage() {
  await exigirAdmin();
  const [{ clientes, veiculos, abertos, respostas }, caixa] = await Promise.all([contarPainel(), caixaDeEntrada()]);
  const novos = caixa.filter((c) => c.situacao !== "agendado");
  const agendados = caixa.filter((c) => c.situacao === "agendado");

  const indicadores = [
    { rotulo: "Clientes", valor: clientes, href: "/painel/clientes" },
    { rotulo: "Veículos", valor: veiculos, href: "/painel/clientes" },
    { rotulo: "Apontamentos abertos", valor: abertos, href: null },
    { rotulo: "Respostas de clientes", valor: respostas, href: null, destaque: respostas > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-suave">Área da empresa</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Painel</h1>
        </div>
        <Link href="/painel/configuracoes" className="text-sm font-semibold text-marca-escura hover:underline">
          Configurações
        </Link>
      </div>

      {(!pushConfigurado() || !emailConfigurado()) && (
        <Aviso tipo="alerta">
          {!pushConfigurado() ? "As notificações no celular ainda não estão configuradas. " : ""}
          {!emailConfigurado() ? "O envio de e-mails de aviso ainda não está configurado. " : ""}
          <Link href="/painel/configuracoes" className="font-semibold underline">Configurar agora</Link>
        </Aviso>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {indicadores.map((i) => {
          const conteudo = (
            <>
              <p className="text-sm text-suave">{i.rotulo}</p>
              <p className={`mt-1 font-titulo text-3xl font-bold ${i.destaque ? "text-marca-escura" : ""}`}>{i.valor}</p>
            </>
          );
          return i.href ? (
            <Link key={i.rotulo} href={i.href} className="rounded-2xl border border-borda bg-white p-5 transition hover:border-marca/50">
              {conteudo}
            </Link>
          ) : (
            <Cartao key={i.rotulo} className={i.destaque ? "border-marca/50" : ""}>{conteudo}</Cartao>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/painel/clientes/novo" className="botao-primario">+ Cadastrar cliente</Link>
        <Link href="/painel/clientes" className="botao-contorno">Buscar cliente ou placa</Link>
      </div>

      <Caixa titulo="📥 Respostas de clientes" vazio="Nenhuma resposta nova. Quando um cliente pedir orçamento ou agendamento, aparece aqui." itens={novos} />
      {agendados.length > 0 && <Caixa titulo="📅 Agendados" vazio="" itens={agendados} />}
    </div>
  );
}

function Caixa({ titulo, vazio, itens }: { titulo: string; vazio: string; itens: Awaited<ReturnType<typeof caixaDeEntrada>> }) {
  return (
    <Cartao className="p-0">
      <h2 className="px-5 pt-5 font-semibold">{titulo}</h2>
      {itens.length === 0 ? (
        <p className="px-5 pt-2 pb-5 text-sm text-suave">{vazio}</p>
      ) : (
        <ul className="mt-2 divide-y divide-borda">
          {itens.map((a) => (
            <li key={a.id}>
              <Link href={`/garagem/${a.veiculo_id}/apontamentos/${a.id}`} className="block px-5 py-4 transition hover:bg-fundo">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {a.veiculo?.dono?.nome ?? "Cliente"} · <span className="text-marca-escura">{SITUACOES_APONTAMENTO[a.situacao].rotuloEmpresa}</span>
                    </p>
                    <p className="text-sm text-suave">{a.titulo}{a.veiculo && ` · ${nomeVeiculo(a.veiculo)}`}</p>
                    {a.mensagem_cliente && <p className="mt-1 line-clamp-2 text-sm">“{a.mensagem_cliente}”</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {a.veiculo && <Placa placa={a.veiculo.placa} tamanho="sm" />}
                    <SeloPrioridade prioridade={a.prioridade} />
                    {a.respondido_em && <span className="text-xs text-suave">{formatarDataHora(a.respondido_em)}</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}
