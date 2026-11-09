import "server-only";
import { cacheLife } from "next/cache";

const BASE = (process.env.FIPE_API_URL || "https://parallelum.com.br/fipe/api/v1").replace(/\/+$/, "");

/** Consulta a API pública da FIPE, com cache de 1 dia (a tabela muda uma vez por mês). */
export async function consultarFipe<T = unknown>(caminho: string): Promise<T> {
  "use cache";
  cacheLife("days");
  const r = await fetch(`${BASE}/${caminho}`, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`FIPE respondeu ${r.status}`);
  return (await r.json()) as T;
}

/** Executa tarefas com no máximo `limite` ao mesmo tempo (para não sobrecarregar a API gratuita). */
export async function emParalelo<T, R>(itens: T[], limite: number, fn: (item: T) => Promise<R>): Promise<(R | null)[]> {
  const resultados: (R | null)[] = new Array(itens.length).fill(null);
  let proximo = 0;
  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, async () => {
      while (proximo < itens.length) {
        const i = proximo++;
        try {
          resultados[i] = await fn(itens[i]);
        } catch {
          resultados[i] = null;
        }
      }
    }),
  );
  return resultados;
}
