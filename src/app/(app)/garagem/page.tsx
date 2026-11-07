import type { Metadata } from "next";
import { Aviso, Cartao } from "@/components/ui";
import { exigirUsuario, primeiroNome } from "@/lib/auth";

export const metadata: Metadata = { title: "Minha garagem" };

const EM_BREVE = [
  {
    titulo: "Meus veículos",
    texto: "Placa, modelo, ano, quilometragem e foto de cada carro.",
    icone: "🚗",
  },
  {
    titulo: "Apontamentos",
    texto: "Avisos da oficina sobre o que precisa de atenção no seu carro.",
    icone: "📍",
  },
  {
    titulo: "Lembretes",
    texto: "Troca de óleo, alinhamento, licenciamento, IPVA e seguro.",
    icone: "⏰",
  },
  {
    titulo: "Orçamentos e agendamentos",
    texto: "Peça um orçamento com fotos ou agende um serviço.",
    icone: "📅",
  },
];

export default async function GaragemPage({ searchParams }: PageProps<"/garagem">) {
  const [usuario, params] = await Promise.all([exigirUsuario(), searchParams]);

  return (
    <div className="space-y-6">
      {params.senha === "ok" && <Aviso tipo="sucesso">Senha alterada com sucesso.</Aviso>}

      <div>
        <p className="text-suave">Olá, {primeiroNome(usuario.nome, usuario.email)} 👋</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Minha garagem</h1>
      </div>

      <Cartao className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-marca-clara text-3xl">🚘</div>
        <h2 className="text-lg font-semibold">Nenhum veículo por aqui ainda</h2>
        <p className="max-w-sm text-suave">
          Em breve você poderá cadastrar seu veículo, ou a nossa equipe fará isso por você no próximo
          atendimento.
        </p>
      </Cartao>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">Chegando nas próximas versões</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {EM_BREVE.map((item) => (
            <Cartao key={item.titulo} className="flex gap-4">
              <span className="text-2xl" aria-hidden="true">{item.icone}</span>
              <div>
                <h3 className="font-semibold">{item.titulo}</h3>
                <p className="text-sm text-suave">{item.texto}</p>
              </div>
            </Cartao>
          ))}
        </div>
      </section>
    </div>
  );
}
