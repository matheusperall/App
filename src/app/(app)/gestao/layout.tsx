import { MenuGestao } from "@/components/gestao/MenuGestao";

export default function GestaoLayout({ children }: LayoutProps<"/gestao">) {
  return (
    <div className="space-y-5">
      <MenuGestao />
      {children}
    </div>
  );
}
