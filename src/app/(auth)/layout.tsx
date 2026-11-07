import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-tinta">
      <header className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6 sm:px-6">
        <Link href="/" aria-label="Página inicial">
          <Logo claro />
        </Link>
      </header>
      <main className="flex flex-1 flex-col rounded-t-[2rem] bg-fundo px-4 pt-8 pb-10 sm:items-center sm:justify-start sm:px-6">
        <div className="w-full sm:max-w-md">{children}</div>
      </main>
    </div>
  );
}
