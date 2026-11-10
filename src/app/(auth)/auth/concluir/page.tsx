import type { Metadata } from "next";
import { Suspense } from "react";
import { ConcluirAcesso } from "./ConcluirAcesso";

export const metadata: Metadata = { title: "Acessando" };

export default function ConcluirPage() {
  return (
    <Suspense>
      <ConcluirAcesso />
    </Suspense>
  );
}
