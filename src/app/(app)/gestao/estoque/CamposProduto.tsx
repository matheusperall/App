import { Campo } from "@/components/ui";
import { UNIDADES, type Produto, type Unidade } from "@/lib/gestao";

export function CamposProduto({ p }: { p?: Produto }) {
  return (
    <>
      <Campo rotulo="Nome do produto">
        <input name="nome" defaultValue={p?.nome} required className="campo" placeholder="Ex.: Shampoo automotivo" />
      </Campo>
        <Campo rotulo="Unidade de controle" obrigatorio>
          <select name="unidade" defaultValue={p?.unidade ?? "ml"} className="campo px-3">
            {(Object.keys(UNIDADES) as Unidade[]).map((u) => <option key={u} value={u}>{u} ({UNIDADES[u]})</option>)}
          </select>
        </Campo>
        <Campo rotulo="Estoque mínimo" dica="Abaixo disso fica crítico">
          <input name="minimo" defaultValue={p ? String(p.minimo).replace(".", ",") : ""} inputMode="decimal" className="campo" placeholder="0" />
        </Campo>
    </>
  );
}
