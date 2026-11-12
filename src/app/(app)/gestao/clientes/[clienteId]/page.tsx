import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Placa, Voltar } from "@/components/garagem";
import { Dinheiro, Indicador, Selo, SeloFatura, Vazio } from "@/components/gestao";
import { FormAcao } from "@/components/gestao/FormAcao";
import { Aviso, Campo, Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { formatarData, nomeVeiculo } from "@/lib/garagem";
import { arred, concluida, faturaEmAberto, linkWhatsApp, mesAtual } from "@/lib/gestao";
import { listarFaturas, listarOS, obterFicha } from "@/lib/gestao-dados";
import { ItemOS } from "../../os/ItemOS";
import { convidarFicha, salvarFicha } from "../actions";
import { CamposFicha } from "../CamposFicha";
import { ReenviarAcesso } from "./ReenviarAcesso";

export const metadata: Metadata = { title: "Cliente" };

export default async function FichaPage({ params, searchParams }: PageProps<"/gestao/clientes/[clienteId]">) {
  const [{ clienteId }, sp] = await Promise.all([params, searchParams, exigirAdmin()]);
  const f = await obterFicha(clienteId);
  if (!f) notFound();
  const [os, faturas] = await Promise.all([listarOS({ filtro: "todas", mes: mesAtual(), clienteId: f.id }), f.lojista ? listarFaturas(f.id) : []]);
  const concluidas = os.filter((o) => concluida(o.status));
  const totalGasto = arred(concluidas.reduce((t, o) => t + o.total, 0));
  const ultima = os.find((o) => o.status !== "cancelada")?.data ?? null;
  const emAberto = arred(os.filter((o) => concluida(o.status) && !o.pago).reduce((t, o) => t + o.total, 0));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Voltar href="/gestao/clientes">Clientes</Voltar>
      {sp.novo && <Aviso tipo="sucesso">Cliente cadastrado! Agora você já pode abrir uma OS para ele.</Aviso>}
      {sp.aviso === "sem-email" && <Aviso tipo="alerta">Para enviar o convite, informe o e-mail do cliente abaixo.</Aviso>}
      {typeof sp.aviso === "string" && sp.aviso !== "sem-email" && <Aviso tipo="alerta">{sp.aviso}</Aviso>}

      <Cartao className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            {f.nome || "Sem nome"}
            {f.lojista && <Selo classe="bg-marca-clara text-marca-escura">Lojista</Selo>}
          </h1>
          <p className="text-suave">{[f.telefone, f.email].filter(Boolean).join(" · ") || "Sem contato"}</p>
          <p className="mt-1 text-sm">{f.perfil_id ? "✅ Tem acesso ao app" : "Sem acesso ao app (só ficha na loja)"}</p>
        </div>
        <div className="flex flex-col gap-2 sm:w-60">
          <Link href={`/gestao/os/nova?cliente=${f.id}`} className="botao-primario w-full text-sm">+ Nova OS</Link>
          {f.telefone && (
            <a href={linkWhatsApp(f.telefone, `Olá, ${f.nome.split(" ")[0]}!`)} target="_blank" rel="noreferrer" className="botao-contorno w-full text-sm">
              Chamar no WhatsApp
            </a>
          )}
          {f.perfil_id && <ReenviarAcesso clienteId={f.perfil_id} />}
        </div>
      </Cartao>

      <div className="grid grid-cols-3 gap-3">
        <Indicador compacto rotulo="Total gasto" valor={<Dinheiro valor={totalGasto} />} />
        <Indicador compacto rotulo="Última visita" valor={<span>{ultima ? formatarData(ultima) : "—"}</span>} />
        <Indicador compacto rotulo="Em aberto" valor={<Dinheiro valor={emAberto} />} destaque={emAberto > 0} />
      </div>

      {!f.perfil_id && (
        <Cartao className="space-y-2">
          <h2 className="font-semibold">Dar acesso ao app</h2>
          <p className="text-sm text-suave">O cliente recebe um e-mail para criar a senha e passa a ver os veículos e o histórico desta ficha na garagem digital. Nada é duplicado.</p>
          <FormAcao acao={convidarFicha} campos={{ id: f.id }} botao="Enviar convite" pendente="Enviando…" classeBotao="botao-escuro w-full">
            <Campo rotulo="E-mail do cliente">
              <input name="email" type="email" defaultValue={f.email ?? ""} required className="campo" />
            </Campo>
          </FormAcao>
        </Cartao>
      )}

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Veículos</h2>
        <Link href={`/garagem/novo?cliente=${f.id}`} className="botao-contorno px-4 py-2 text-sm">+ Veículo</Link>
      </div>
      {f.veiculos.length === 0 ? (
        <Cartao><p className="text-sm text-suave">Nenhum veículo cadastrado.</p></Cartao>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {f.veiculos.map((v) => (
            <Link key={v.id} href={`/garagem/${v.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-borda bg-white p-4 transition hover:border-marca/50">
              <span className="min-w-0">
                <span className="block truncate font-medium">{nomeVeiculo(v)}</span>
                <span className="text-xs text-suave">{v.ano ?? ""} · histórico, apontamentos e lembretes</span>
              </span>
              <Placa placa={v.placa} tamanho="sm" />
            </Link>
          ))}
        </div>
      )}

      {f.lojista && (
        <Cartao className="p-0">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-semibold">Faturas</h2>
            <Link href="/gestao/faturas" className="text-sm font-semibold text-marca-escura">A faturar</Link>
          </div>
          {faturas.length === 0 ? (
            <Vazio>Nenhuma fatura ainda.</Vazio>
          ) : (
            <ul className="mt-2 divide-y divide-borda">
              {faturas.map((x) => (
                <li key={x.id}>
                  <Link href={`/gestao/faturas/${x.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-fundo">
                    <span>#{x.numero} · vence {formatarData(x.vencimento)}</span>
                    <span className="flex items-center gap-2"><Dinheiro valor={faturaEmAberto(x) ? x.total - x.valor_pago : x.total} /><SeloFatura f={x} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      )}

      <Cartao className="p-0">
        <h2 className="px-5 pt-5 font-semibold">Histórico de OS</h2>
        {os.length === 0 ? <Vazio>Nenhuma OS ainda.</Vazio> : <ul className="mt-2 divide-y divide-borda">{os.map((o) => <ItemOS key={o.id} os={o} comData />)}</ul>}
      </Cartao>

      <Cartao className="space-y-3">
        <h2 className="font-semibold">Editar dados</h2>
        <FormAcao acao={salvarFicha} campos={{ id: f.id }} botao="Salvar" classeBotao="botao-contorno w-full">
          <CamposFicha f={f} />
        </FormAcao>
      </Cartao>
    </div>
  );
}
