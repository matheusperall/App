import { AbasGestao } from "@/components/gestao/Abas";

export default function GestaoLayout({ children }: LayoutProps<"/gestao">) {
  return (
    <div className="space-y-5">
      <AbasGestao />
      {children}
    </div>
  );
}
