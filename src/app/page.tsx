import Link from "next/link";
import { Logo } from "@/components/Logo";

const RECURSOS = [
  { titulo: "Histórico completo", texto: "Tudo o que foi feito no seu carro, com data, quilometragem e fotos." },
  { titulo: "Apontamentos da oficina", texto: "Receba um aviso quando identificarmos algo que precisa de atenção." },
  { titulo: "Lembretes no prazo", texto: "Troca de óleo, alinhamento, licenciamento, IPVA e seguro sem esquecer." },
  { titulo: "Orçamento e agendamento", texto: "Mande fotos, peça orçamento e agende o serviço pelo app." },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <section className="relative overflow-hidden bg-tinta text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full border-[40px] border-marca/15"
        />
        <div className="relative mx-auto max-w-5xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-16 sm:px-6 sm:pb-24">
          <header className="flex items-center justify-between">
            <Logo claro />
            <Link href="/entrar" className="rounded-lg px-3 py-2 text-sm font-semibold text-white/80 hover:text-white">
              Entrar
            </Link>
          </header>

          <div className="mt-14 max-w-xl sm:mt-20">
            <p className="mb-3 inline-block rounded-full bg-marca/15 px-3 py-1 text-sm font-medium text-marca">
              Garagem digital
            </p>
            <h1 className="text-4xl leading-tight font-bold sm:text-5xl">
              Seu carro com cara de <span className="text-marca">zero</span>. Sempre.
            </h1>
            <p className="mt-4 text-lg text-white/70">
              Acompanhe os serviços, os pendentes, as manutenções e os vencimentos do seu veículo em
              um só lugar, direto com a nossa equipe.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/cadastro" className="botao-primario">Criar minha garagem</Link>
              <Link href="/entrar" className="botao border border-white/20 text-white hover:bg-white/10">Já tenho conta</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold">Tudo sobre o seu carro, na palma da mão</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {RECURSOS.map((r, i) => (
            <div key={r.titulo} className="rounded-2xl border border-borda bg-white p-5">
              <span className="font-titulo text-sm font-bold text-marca">0{i + 1}</span>
              <h3 className="mt-1 font-semibold">{r.titulo}</h3>
              <p className="mt-1 text-sm text-suave">{r.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto border-t border-borda py-6 text-center text-sm text-suave">
        <Link href="/privacidade" className="hover:underline">Privacidade</Link>
        {" · "}
        <Link href="/termos" className="hover:underline">Termos de uso</Link>
        <p className="mt-1">© Sempre Zero</p>
      </footer>
    </div>
  );
}
