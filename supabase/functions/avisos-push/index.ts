// Edge Function "avisos-push": envia as notificações push do Dashvia.
// Chamada pelo pg_cron (modos "vencimentos" e "novidades", com o cabeçalho x-cron-secret)
// e pelo botão "Enviar teste" do site (modo "teste", com o login da pessoa).
// Segredos (painel do Supabase): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET, SITE_URL.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o próprio Supabase já entrega à função.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { gastoDoBanco } from "./avisos.mjs";
import { enviarParaUsuario, executarNovidades, executarVencimentos } from "./executar.mjs";

const SITE_URL = (Deno.env.get("SITE_URL") || "").replace(/\/$/, "");
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "",
  Deno.env.get("VAPID_PUBLIC_KEY") || "",
  Deno.env.get("VAPID_PRIVATE_KEY") || ""
);

const banco = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false }
});

// deno-lint-ignore no-explicit-any
function falhar(erro: any) {
  if (erro) throw new Error(erro.message || String(erro));
}

// Último erro de envio (só código e mensagem curta, sem segredos): o modo "teste" devolve isso para ajudar a diagnosticar
let ultimoErro: { status?: number, mensagem: string } | null = null;

const deps = {
  async listarInscricoes() {
    const { data, error } = await banco.from("push_inscricoes").select("id, user_id, endpoint, p256dh, auth");
    falhar(error);
    return data || [];
  },

  // Gastos pessoais da pessoa mais os do espaço em que ela está
  async listarGastosDe(userId: string) {
    const pessoais = await banco.from("gastos").select("*").eq("user_id", userId).is("espaco_id", null);
    falhar(pessoais.error);
    const membro = await banco.from("membros").select("espaco_id").eq("user_id", userId).maybeSingle();
    falhar(membro.error);
    let doEspaco: unknown[] = [];
    if (membro.data) {
      const r = await banco.from("gastos").select("*").eq("espaco_id", membro.data.espaco_id);
      falhar(r.error);
      doEspaco = r.data || [];
    }
    return [...(pessoais.data || []), ...doEspaco].map(gastoDoBanco);
  },

  // true se o aviso é novo; false se já tinha sido registrado (chave primária repetida)
  async registrarAviso(userId: string, chave: string) {
    const { error } = await banco.from("avisos_enviados").insert({ user_id: userId, chave });
    if (!error) return true;
    if (error.code === "23505") return false;
    throw new Error(error.message);
  },

  async desfazerAviso(userId: string, chave: string) {
    falhar((await banco.from("avisos_enviados").delete().eq("user_id", userId).eq("chave", chave)).error);
  },

  async apagarInscricao(id: number) {
    falhar((await banco.from("push_inscricoes").delete().eq("id", id)).error);
  },

  async lerEstado(chave: string) {
    const { data, error } = await banco.from("estado_envio").select("valor").eq("chave", chave).maybeSingle();
    falhar(error);
    return data ? data.valor : null;
  },

  async gravarEstado(chave: string, valor: string) {
    falhar((await banco.from("estado_envio").upsert({ chave, valor })).error);
  },

  async buscarNovidadesJs() {
    const r = await fetch(SITE_URL + "/js/novidades.js", { cache: "no-store" });
    if (!r.ok) throw new Error("novidades.js respondeu " + r.status);
    return await r.text();
  },

  // "gone" = o serviço de push disse que o aparelho não existe mais (a inscrição deve ser apagada)
  // deno-lint-ignore no-explicit-any
  async enviar(inscricao: any, notificacao: unknown) {
    try {
      await webpush.sendNotification(
        { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } },
        JSON.stringify(notificacao),
        { TTL: 60 * 60 * 24 }
      );
      return "ok";
    } catch (erro) {
      // deno-lint-ignore no-explicit-any
      const status = (erro as any)?.statusCode;
      ultimoErro = { status, mensagem: String((erro as any)?.body || (erro as any)?.message || erro).slice(0, 200) };
      console.error("falha no envio", inscricao.id, status, ultimoErro.mensagem);
      return status === 404 || status === 410 ? "gone" : "erro";
    }
  }
};

// Compara sem parar no primeiro caractere diferente
function iguais(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

const CORS = {
  "Access-Control-Allow-Origin": SITE_URL,
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "método não permitido" }, 405);

  const { modo } = await req.json().catch(() => ({ modo: "" }));

  try {
    if (modo === "teste") {
      const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data } = await banco.auth.getUser(jwt);
      if (!data?.user) return resposta({ erro: "não autorizado" }, 401);

      ultimoErro = null;
      const { data: inscricoes, error } = await banco.from("push_inscricoes").select("id, user_id, endpoint, p256dh, auth").eq("user_id", data.user.id);
      falhar(error);
      const resultado = await enviarParaUsuario(deps, inscricoes || [], {
        titulo: "Teste do Dashvia",
        corpo: "Se você viu isto, as notificações funcionam.",
        url: "dashboard.html",
        tag: "teste"
      });
      return resposta({ ...resultado, aparelhos: (inscricoes || []).length, ultimoErro });
    }

    if (modo === "vencimentos" || modo === "novidades") {
      if (!iguais(req.headers.get("x-cron-secret") || "", CRON_SECRET)) return resposta({ erro: "não autorizado" }, 401);
      const resultado = modo === "vencimentos" ? await executarVencimentos(deps, new Date()) : await executarNovidades(deps, new Date());
      return resposta(resultado);
    }

    return resposta({ erro: "modo inválido" }, 400);
  } catch (erro) {
    console.error(modo, erro);
    return resposta({ erro: "falha ao processar" }, 500);
  }
});
