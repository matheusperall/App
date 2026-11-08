import type { Metadata } from "next";
import Link from "next/link";
import { CartaoVeiculo } from "@/components/garagem";
import { Aviso, Cartao } from "@/components/ui";
import { exigirUsuario, primeiroNome } from "@/lib/auth";
import { listarApontamentos, listarManutencoes, listarVeiculos, urlsDasFotos } from "@/lib/dados";
import { AtivarNotificacoes } from "@/components/AtivarNotificacoes";
import { vapidPublica } from "@/lib/notificar";

export const metadata: Metadata = { title: "Minha garagem" };

export default async function GaragemPage({ searchParams }: PageProps<"/garagem">) {
  const [usuario, params] = await Promise.all([exigirUsuario(), searchParams]);
  const veiculos = await listarVeiculos(usuario.id);
  const ids = veiculos.map((v) => v.id);
  const [manutencoes, apontamentos, fotos] = await Promise.all([
    listarManutencoes(ids),
    listarApontamentos(ids),
    urlsDasFotos(veiculos.map((v) => v.foto)),
  ]);

  return (
    <div className="space-y-6">
      {params.senha === "ok" && <Aviso tipo="sucesso">Senha alterada com sucesso.</Aviso>}

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-suave">Olá, {primeiroNome(usuario.nome, usuario.email)} 👋</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Minha garagem</h1>
        </div>
        {veiculos.length > 0 && (
          <Link href="/garagem/novo" className="botao-primario px-4 py-2.5 text-sm">
            + Veículo
          </Link>
        )}
      </div>

      <AtivarNotificacoes chavePublica={vapidPublica()} compacto />

      {usuario.papel === "admin" && (
        <Aviso>
          Aqui ficam os seus veículos pessoais. Para cuidar dos veículos dos clientes, use{" "}
          <Link href="/painel/clientes" className="font-semibold underline">Painel › Clientes</Link>.
        </Aviso>
      )}

      {veiculos.length === 0 ? (
        <Cartao className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-marca-clara text-3xl">🚘</div>
          <h2 className="text-lg font-semibold">Sua garagem está vazia</h2>
          <p className="max-w-sm text-suave">
            Cadastre seu veículo para acompanhar o histórico, as manutenções e os vencimentos. Se preferir,
            a nossa equipe faz isso no seu próximo atendimento.
          </p>
          <Link href="/garagem/novo" className="botao-primario mt-2">Cadastrar meu veículo</Link>
        </Cartao>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {veiculos.map((v) => (
            <CartaoVeiculo
              key={v.id}
              veiculo={v}
              fotoUrl={v.foto ? fotos[v.foto] : undefined}
              manutencoes={manutencoes.filter((m) => m.veiculo_id === v.id)}
              apontamentos={apontamentos.filter((a) => a.veiculo_id === v.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
