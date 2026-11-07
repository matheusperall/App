import type { Metadata } from "next";
import { Suspense } from "react";
import { FormEntrar } from "./FormEntrar";

export const metadata: Metadata = { title: "Entrar" };

export default function EntrarPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Bem-vindo de volta</h1>
        <p className="text-suave">Entre para ver sua garagem digital.</p>
      </div>
      <Suspense>
        <FormEntrar />
      </Suspense>
    </div>
  );
}
