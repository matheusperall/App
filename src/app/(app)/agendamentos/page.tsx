import type { Metadata } from "next";
import Link from "next/link";
import { ItemAgendamento } from "@/components/agendamento";
import { Aviso, Cartao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth";
import { agendaEmpresa, listarAgendamentos, listarVeiculos } from "@/lib/dados";
import { googleConfigurado } from "@/lib/google-agenda";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendamentosPage() {
  const usuario = await exigirUsuario();

  if (usuario.papel === "admin") {
    const { aConfirmar, proximos } = await agendaEmpresa();
    return (
      <div className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-suave">Área da empresa</p>
            <h1 className="text-2xl font-bold sm:text-3xl">Agenda</h1>
          </div>
        </div>
        {!googleConfigurado() && (
          <Aviso tipo="alerta">
            A Google Agenda ainda não está conectada. Os agendamentos funcionam, mas não vão para a sua agenda.{" "}
            <Link href="/painel/configuracoes" className="font-semibold underline">Conectar</Link>
          </Aviso>
        )}
        <Cartao className="p-0">
          <h2 className="px-5 pt-5 font-semibold">📥 A confirmar {aConfirmar.length > 0 && <span className="text-suave">({aConfirmar.length})</span>}</h2>
          {aConfirmar.length === 0 ? (
            <p className="px-5 pt-2 pb-5 text-sm text-suave">Nenhum pedido aguardando confirmação.</p>
          ) : (
            <ul className="mt-2 divide-y divide-borda">{aConfirmar.map((a) => <ItemAgendamento key={a.id} a={a} empresa />)}</ul>
          )}
        </Cartao>
        <Cartao className="p-0">
          <h2 className="px-5 pt-5 font-semibold">📅 Próximos</h2>
          {proximos.length === 0 ? (
            <p className="px-5 pt-2 pb-5 text-sm text-suave">Nada agendado.</p>
          ) : (
            <ul className="mt-2 divide-y divide-borda">{proximos.map((a) => <ItemAgendamento key={a.id} a={a} empresa />)}</ul>
          )}
        </Cartao>
      </div>
    );
  }

  const veiculos = await listarVeiculos(usuario.id);
  const lista = await listarAgendamentos(veiculos.map((v) => v.id));
  const ativos = lista.filter((a) => a.situacao === "solicitado" || a.situacao === "confirmado");
  const anteriores = lista.filter((a) => !ativos.includes(a));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">Agenda</h1>
        {veiculos.length > 0 && <Link href="/agendamentos/novo" className="botao-primario px-4 py-2.5 text-sm">+ Agendar</Link>}
      </div>
      {veiculos.length === 0 ? (
        <Cartao className="space-y-3 text-center">
          <p className="text-suave">Cadastre seu veículo para agendar serviços.</p>
          <Link href="/garagem/novo" className="botao-primario">Cadastrar veículo</Link>
        </Cartao>
      ) : ativos.length === 0 ? (
        <Cartao className="space-y-3 py-8 text-center">
          <div className="text-4xl" aria-hidden="true">📅</div>
          <h2 className="font-semibold">Agende sua lavagem em segundos</h2>
          <p className="mx-auto max-w-sm text-sm text-suave">
            Escolha um horário livre para lavagem, ou peça um horário para outros serviços. Atendemos de segunda a sexta, das 8h às 18h.
          </p>
          <Link href="/agendamentos/novo" className="botao-primario">Agendar</Link>
        </Cartao>
      ) : (
        <Cartao className="p-0">
          <ul className="divide-y divide-borda">{ativos.map((a) => <ItemAgendamento key={a.id} a={a} />)}</ul>
        </Cartao>
      )}
      {anteriores.length > 0 && (
        <details className="rounded-2xl border border-borda bg-white">
          <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-suave">Anteriores ({anteriores.length})</summary>
          <ul className="divide-y divide-borda border-t border-borda">{anteriores.map((a) => <ItemAgendamento key={a.id} a={a} />)}</ul>
        </details>
      )}
    </div>
  );
}
