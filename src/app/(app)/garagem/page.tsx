import type { Metadata } from "next";
import Link from "next/link";
import { CartaoVeiculo, contarAlertas } from "@/components/garagem";
import { Cabecalho, ResumoPeriodo } from "@/components/gestao/Cabecalho";
import { apontamentoAberto, hojeISO, ritmoDoVeiculo, situacaoDocumento } from "@/lib/garagem";
import { documentosAutomaticos } from "@/lib/calendarios";
import { Aviso, Cartao } from "@/components/ui";
import { exigirUsuario, primeiroNome } from "@/lib/auth";
import { listarAnexos, listarApontamentos, listarDocumentosVeiculos, listarManutencoes, listarVeiculos, obterCnh, urlsDasFotos } from "@/lib/dados";
import { Anexos } from "@/components/Anexos";
import { FormDocumento } from "@/components/FormDocumento";
import { Bloco } from "@/components/gestao/Bloco";
import { AtivarNotificacoes } from "@/components/AtivarNotificacoes";
import { vapidPublica } from "@/lib/notificar";

export const metadata: Metadata = { title: "Minha garagem" };

export default async function GaragemPage({ searchParams }: PageProps<"/garagem">) {
  const [usuario, params] = await Promise.all([exigirUsuario(), searchParams]);
  const veiculos = await listarVeiculos(usuario.id);
  const ids = veiculos.map((v) => v.id);
  const [manutencoes, apontamentos, documentos, fotos, cnh, anexosCnh] = await Promise.all([
    listarManutencoes(ids),
    listarApontamentos(ids),
    listarDocumentosVeiculos(ids),
    urlsDasFotos(veiculos.map((v) => v.foto)),
    obterCnh(usuario.id),
    listarAnexos({ donoId: usuario.id }),
  ]);

  const alertas = veiculos.map((v) => contarAlertas(manutencoes.filter((m) => m.veiculo_id === v.id), v.km_atual, ritmoDoVeiculo(v)));
  const hoje = hojeISO();
  // Mesma conta do cartão de cada veículo: documentos cadastrados + IPVA/licenciamento pelo final da placa
  const situacoesDocs = veiculos.flatMap((v) => {
    const manuais = documentos.filter((d) => d.veiculo_id === v.id);
    return [...documentosAutomaticos(v, manuais, hoje), ...manuais].map((d) => situacaoDocumento(d.vencimento, hoje).situacao);
  });
  const docsVencidos = situacoesDocs.filter((x) => x === "vencida").length;
  const docsEmBreve = situacoesDocs.filter((x) => x === "em_breve").length;

  return (
    <div className="space-y-4">
      {params.senha === "ok" && <Aviso tipo="sucesso">Senha alterada com sucesso.</Aviso>}

      <Cabecalho icone="carro" titulo="Minha garagem" acao={veiculos.length > 0 ? { href: "/garagem/novo", rotulo: "Veículo" } : undefined} />
      <p className="px-1 text-suave">Olá, {primeiroNome(usuario.nome, usuario.email)} 👋</p>

      {veiculos.length > 0 && (
        <ResumoPeriodo
          titulo="Resumo"
          itens={[
            { rotulo: "Veículos", valor: veiculos.length, formato: "numero" },
            { rotulo: "Manutenções vencidas", valor: alertas.reduce((t, a) => t + a.vencidas, 0), formato: "numero", cor: alertas.some((a) => a.vencidas) ? "vermelho" : "verde" },
            { rotulo: "Manutenções em breve", valor: alertas.reduce((t, a) => t + a.emBreve, 0), formato: "numero", cor: "amarelo" },
            { rotulo: "Apontamentos abertos", valor: apontamentos.filter(apontamentoAberto).length, formato: "numero", cor: apontamentos.some(apontamentoAberto) ? "amarelo" : "verde" },
            { rotulo: "Documentos vencidos", valor: docsVencidos, formato: "numero", cor: docsVencidos ? "vermelho" : "verde" },
            { rotulo: "Documentos em breve", valor: docsEmBreve, formato: "numero", cor: "amarelo" },
          ]}
        />
      )}

      <AtivarNotificacoes chavePublica={vapidPublica()} compacto />

      {usuario.papel === "admin" && (
        <Aviso>
          Aqui ficam os seus veículos pessoais. Para cuidar dos veículos dos clientes, use{" "}
          <Link href="/gestao/clientes" className="font-semibold underline">Gestão › Clientes</Link>.
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>*]:min-w-0">
          {veiculos.map((v) => (
            <CartaoVeiculo
              key={v.id}
              veiculo={v}
              fotoUrl={v.foto ? fotos[v.foto] : undefined}
              manutencoes={manutencoes.filter((m) => m.veiculo_id === v.id)}
              apontamentos={apontamentos.filter((a) => a.veiculo_id === v.id)}
              documentos={documentos.filter((d) => d.veiculo_id === v.id)}
            />
          ))}
        </div>
      )}

      <Bloco icone="documento" titulo="Minha CNH" className="scroll-mt-28" direita={<span className="text-xs text-suave">Avisamos antes de vencer</span>}>
        <div id="cnh" className="space-y-3">
          <FormDocumento tipo="cnh" atual={cnh} />
          <Anexos anexos={anexosCnh.filter((a) => a.tipo === "cnh")} pasta={usuario.id} tipos={["cnh"]} />
        </div>
      </Bloco>
    </div>
  );
}
