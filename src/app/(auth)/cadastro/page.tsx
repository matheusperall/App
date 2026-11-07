import type { Metadata } from "next";
import { FormCadastro } from "./FormCadastro";

export const metadata: Metadata = { title: "Criar conta" };

export default function CadastroPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Crie sua garagem digital</h1>
        <p className="text-suave">Leva menos de um minuto.</p>
      </div>
      <FormCadastro />
    </div>
  );
}
