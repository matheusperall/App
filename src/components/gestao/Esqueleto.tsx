// Esqueletos mostrados na hora, enquanto a tela carrega (a navegação fica imediata).

const Bloco = ({ className = "" }: { className?: string }) => <div className={`animate-pulse rounded-xl bg-borda/70 ${className}`} />;

export function EsqueletoLista({ indicadores = 0, linhas = 6 }: { indicadores?: number; linhas?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Bloco className="h-4 w-20" />
          <Bloco className="h-8 w-48" />
        </div>
        <Bloco className="h-10 w-28" />
      </div>
      {indicadores > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: indicadores }, (_, i) => <Bloco key={i} className="h-24 rounded-2xl" />)}
        </div>
      )}
      <Bloco className="h-11" />
      <div className="overflow-hidden rounded-2xl border border-borda bg-white">
        {Array.from({ length: linhas }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 border-b border-borda px-5 py-4 last:border-0">
            <div className="flex-1 space-y-2">
              <Bloco className="h-4 w-2/3" />
              <Bloco className="h-3 w-1/2" />
            </div>
            <Bloco className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EsqueletoDetalhe() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" aria-busy="true" aria-label="Carregando">
      <Bloco className="h-4 w-32" />
      <Bloco className="h-36 rounded-2xl" />
      <Bloco className="h-48 rounded-2xl" />
      <Bloco className="h-32 rounded-2xl" />
    </div>
  );
}
