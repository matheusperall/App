import type { Metadata } from "next";
import Link from "next/link";
import { CartaoVeiculo, contarAlertas } from "@/components/garagem";
import { Cabecalho, ResumoPeriodo, type Cor } from "@/components/gestao/Cabecalho";
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

  const hoje = hojeISO();
  // Pendências de cada veículo, com a mesma conta do cartão (documentos incluem IPVA/licenciamento pelo final da placa)
  const porVeiculo = veiculos.map((v) => {
    const m = contarAlertas(manutencoes.filter((x) => x.veiculo_id === v.id), v.km_atual, ritmoDoVeiculo(v));
    const manuais = documentos.filter((d) => d.veiculo_id === v.id);
    const docs = [...documentosAutomaticos(v, manuais, hoje), ...manuais].map((d) => situacaoDocumento(d.vencimento, hoje).situacao);
    return {
      id: v.id,
      "manutencoes-vencidas": m.vencidas,
      "manutencoes-em-breve": m.emBreve,
      apontamentos: apontamentos.filter((a) => a.veiculo_id === v.id && apontamentoAberto(a)).length,
      "documentos-vencidos": docs.filter((x) => x === "vencida").length,
      "documentos-em-breve": docs.filter((x) => x === "em_breve").length,
    };
  });
  type Chave = Exclude<keyof (typeof porVeiculo)[number], "id">;
  const total = (c: Chave) => porVeiculo.reduce((t, x) => t + x[c], 0);
  // Para onde leva o número do resumo: direto ao veículo, ou à lista filtrada quando são vários
  const destino = (c: Chave) => {
    const com = porVeiculo.filter((x) => x[c] > 0);
    if (com.length === 0) return undefined;
    if (com.length > 1) return `/garagem?ver=${c}#veiculos`;
    const id = com[0].id;
    return `/garagem/${id}#${c === "apontamentos" ? "apontamentos" : c.startsWith("documentos") ? "documentos" : "manutencoes"}`;
  };
  const ROTULOS: Record<Chave, string> = {
    "manutencoes-vencidas": "Manutenções vencidas",
    "manutencoes-em-breve": "Manutenções em breve",
    apontamentos: "Apontamentos abertos",
    "documentos-vencidos": "Documentos vencidos",
    "documentos-em-breve": "Documentos em breve",
  };
  const filtro = typeof params.ver === "string" && params.ver in ROTULOS ? (params.ver as Chave) : undefined;
  const visiveis = filtro ? veiculos.filter((v) => (porVeiculo.find((x) => x.id === v.id)?.[filtro] ?? 0) > 0) : veiculos;
  const item = (c: Chave, corComValor: Cor) => {
    const valor = total(c);
    return { rotulo: ROTULOS[c], valor, formato: "numero" as const, cor: valor ? corComValor : ("verde" as Cor), href: destino(c) };
  };

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
            item("manutencoes-vencidas", "vermelho"),
            item("manutencoes-em-breve", "amarelo"),
            item("apontamentos", "amarelo"),
            item("documentos-vencidos", "vermelho"),
            item("documentos-em-breve", "amarelo"),
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
        <div id="veiculos" className="scroll-mt-28 space-y-3">
          {filtro && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-marca/30 bg-marca-clara/60 px-4 py-2.5 text-sm">
              <span>
                Mostrando os veículos com <strong>{ROTULOS[filtro].toLowerCase()}</strong>
              </span>
              <Link href="/garagem" className="shrink-0 font-semibold text-marca-escura hover:underline">
                Ver todos
              </Link>
            </div>
          )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>*]:min-w-0">
          {visiveis.map((v) => (
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
