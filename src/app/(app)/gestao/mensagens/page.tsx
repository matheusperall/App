import type { Metadata } from "next";
import { Cabecalho } from "@/components/gestao/Cabecalho";
import { exigirAdmin } from "@/lib/auth";
import { obterModelosMensagens } from "@/lib/gestao-dados";
import { MODELOS, CAMPOS, type Campo, type ChaveMensagem } from "@/lib/mensagens";
import { EditorModelo } from "./EditorModelo";

export const metadata: Metadata = { title: "Mensagens de WhatsApp" };

/** Campos que fazem sentido em cada mensagem (os da OS, do orçamento ou do agendamento). */
const COMUNS: Campo[] = ["cliente", "cliente_completo", "empresa", "marca", "modelo", "ano", "cor", "placa"];
const DA_OS: Campo[] = ["numero", "data", "situacao", "servicos", "desconto", "total", "pago", "em_aberto", "pagamento_retirada", "pagamentos", "quitacao", "observacoes"];
const CAMPOS_DE: Record<ChaveMensagem, Campo[]> = {
  os_resumo: [...COMUNS, ...DA_OS],
  os_pronta: [...COMUNS, ...DA_OS],
  os_cobranca: [...COMUNS, ...DA_OS],
  os_comprovante: [...COMUNS, ...DA_OS],
  orcamento: [...COMUNS, "numero", "itens", "total", "prazo", "validade", "observacoes"],
  orcamento_combinar: [...COMUNS, "numero", "itens", "total", "prazo", "validade"],
  agendamento_lembrete: [...COMUNS, "quando", "servico"],
  agendamento_conversa: [...COMUNS, "quando", "servico"],
};

export default async function MensagensPage() {
  await exigirAdmin();
  const salvos = await obterModelosMensagens();
  return (
    <div className="space-y-4">
      <Cabecalho icone="atendimento" titulo="Mensagens de WhatsApp" />
      <p className="px-1 text-sm text-suave">
        Modelos dos textos que aparecem em <strong className="text-texto">💬 Enviar ao cliente</strong> na OS, no orçamento e no agendamento.
        Os campos entre chaves, como <code className="text-marca-escura">{"{cliente}"}</code> e <code className="text-marca-escura">{"{marca}"}</code>, são trocados pelos dados de cada cliente.
      </p>
      {(Object.keys(MODELOS) as ChaveMensagem[]).map((chave) => {
        const m = MODELOS[chave];
        return (
          <section key={chave} id={chave} className="scroll-mt-28 space-y-3 rounded-2xl border border-borda bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{m.rotulo}</h2>
              <span className="text-xs text-suave">
                Aparece em: {m.onde}
                {salvos[chave] ? " · editado" : " · padrão"}
              </span>
            </div>
            <EditorModelo chave={chave} atual={salvos[chave] ?? m.padrao} padrao={m.padrao} campos={CAMPOS_DE[chave].filter((c) => c in CAMPOS)} />
          </section>
        );
      })}
    </div>
  );
}
