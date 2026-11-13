import { Campo } from "@/components/ui";
import type { Ficha } from "@/lib/gestao";

export function CamposFicha({ f }: { f?: Ficha }) {
  return (
    <>
      <Campo rotulo="Nome">
        <input name="nome" defaultValue={f?.nome} required className="campo" />
      </Campo>
        <Campo rotulo="Celular (WhatsApp)">
          <input name="telefone" type="tel" inputMode="tel" defaultValue={f?.telefone ?? ""} className="campo" placeholder="(17) 99999-0000" />
        </Campo>
        <Campo rotulo="E-mail (opcional)" dica="Necessário só para dar acesso ao app">
          <input name="email" type="email" inputMode="email" defaultValue={f?.email ?? ""} className="campo" />
        </Campo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="lojista" defaultChecked={f?.lojista} className="h-4 w-4 accent-marca" />
        Lojista (revenda de carros — paga por fatura mensal)
      </label>
      <Campo rotulo="Observações (opcional)">
        <textarea name="observacoes" defaultValue={f?.observacoes ?? ""} className="campo min-h-16" />
      </Campo>
    </>
  );
}
