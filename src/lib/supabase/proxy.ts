import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/env";

/** Rotas que exigem login */
const PROTECTED = ["/garagem", "/painel", "/conta"];
/** Rotas de quem ainda não entrou (usuário logado é mandado para o app) */
const GUEST_ONLY = ["/entrar", "/cadastro"];

const matches = (path: string, list: string[]) =>
  list.some((p) => path === p || path.startsWith(`${p}/`));

export async function updateSession(request: NextRequest) {
  try {
    return await renovarSessao(request);
  } catch (erro) {
    // Nunca derruba o site por causa do login: registra e segue.
    console.error("[proxy] falha ao verificar a sessão:", erro);
    return NextResponse.next({ request });
  }
}

async function renovarSessao(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Não coloque código entre createServerClient e getClaims: renova a sessão.
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;

  const redirectTo = (pathname: string, keepNext = false) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = keepNext ? `?next=${encodeURIComponent(path)}` : "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!loggedIn && matches(path, PROTECTED)) return redirectTo("/entrar", true);
  if (loggedIn && matches(path, GUEST_ONLY)) return redirectTo("/garagem");

  return response;
}
