// Notificações push no aparelho (Configurações): ativar, desativar e enviar um teste.
// As funções puras (urlBase64ParaBytes, estadoDasNotificacoes) ficam no começo para poderem ser testadas sem navegador.

// Chave pública VAPID (gerada por ferramentas/gerar-vapid.mjs). Vazia = recurso ainda não configurado: a linha não aparece.
const CHAVE_VAPID_PUBLICA = "BPH-Rq_WeweXm830aJh9iEtLhmwB6LAUcdAHlnWKkfxfVMWPvLoX7Y35W05ENiTUfjU06X9XfUAAgCk8Fg0JTIY";
const URL_AVISOS_PUSH = "https://xouwjsnfkhegwxhxtmeb.supabase.co/functions/v1/avisos-push";

function urlBase64ParaBytes(texto) {
  const base64 = String(texto).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binario, function (c) { return c.charCodeAt(0); });
}

// info: { suportado, permissao: "default" | "granted" | "denied", ios_sem_instalar, inscrito }
function estadoDasNotificacoes(info) {
  // No iPhone o Safari comum nem tem push: só funciona com o site instalado na tela inicial
  if (info.ios_sem_instalar) return "instale-no-iphone";
  if (!info.suportado) return "nao-suportado";
  if (info.permissao === "denied") return "bloqueado";
  if (info.permissao === "granted" && info.inscrito) return "ativo";
  return "desativado";
}

async function inscricaoDesteAparelho() {
  if (!("serviceWorker" in navigator)) return null;
  const registro = await navigator.serviceWorker.getRegistration();
  return registro ? await registro.pushManager.getSubscription() : null;
}

async function infoDasNotificacoes() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const instalado = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const suportado = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return {
    suportado: suportado,
    permissao: suportado ? Notification.permission : "default",
    ios_sem_instalar: ios && !instalado,
    inscrito: suportado ? !!(await inscricaoDesteAparelho()) : false
  };
}

async function ativarNotificacoes() {
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return;

  const registro = await navigator.serviceWorker.ready;
  const inscricao = (await registro.pushManager.getSubscription()) || await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ParaBytes(CHAVE_VAPID_PUBLICA)
  });
  const dados = inscricao.toJSON();

  // O banco troca de dono se este aparelho ainda estava ligado a outra conta (função registrar_push)
  const { error } = await db.rpc("registrar_push", { p_endpoint: dados.endpoint, p_p256dh: dados.keys.p256dh, p_auth: dados.keys.auth });
  if (error) throw error;
}

async function desativarNotificacoes() {
  await apagarInscricaoDesteAparelho();
}

async function enviarTeste() {
  const { data } = await db.auth.getSession();
  const resposta = await fetch(URL_AVISOS_PUSH, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + data.session.access_token },
    body: JSON.stringify({ modo: "teste" })
  });
  if (!resposta.ok) throw new Error("A função respondeu " + resposta.status);
  return await resposta.json();
}

// ----- Linha em Configurações -----
const TEXTOS_ESTADO = {
  "ativo": { valor: "Ativas", dica: "" },
  "desativado": { valor: "Desativadas", dica: "Avisamos de boletos e parcelas perto de vencer e de novidades, mesmo com o site fechado." },
  "bloqueado": { valor: "Bloqueadas", dica: "As notificações estão bloqueadas neste navegador. Libere nas configurações do site e tente de novo." },
  "instale-no-iphone": { valor: "Instale o site", dica: "No iPhone, toque em Compartilhar e em \"Adicionar à Tela de Início\". Depois abra o Dashvia por lá e ative aqui." },
  "nao-suportado": { valor: "Indisponível", dica: "Este navegador não permite notificações. Você continua vendo os avisos no sino." }
};

async function montarLinhaNotificacoes() {
  const grupo = document.getElementById("grupo-notificacoes");
  if (!grupo || !CHAVE_VAPID_PUBLICA) return;
  grupo.classList.remove("oculto");

  const botao = document.getElementById("btn-push");
  const botaoTeste = document.getElementById("btn-push-teste");
  const valor = document.getElementById("valor-push");
  const dica = document.getElementById("dica-push");

  async function atualizar() {
    const estado = estadoDasNotificacoes(await infoDasNotificacoes());
    valor.textContent = TEXTOS_ESTADO[estado].valor;
    dica.textContent = TEXTOS_ESTADO[estado].dica;
    dica.classList.toggle("oculto", !TEXTOS_ESTADO[estado].dica);
    botaoTeste.classList.toggle("oculto", estado !== "ativo");
    botao.dataset.estado = estado;
  }

  botao.addEventListener("click", async function () {
    const estado = botao.dataset.estado;
    if (estado !== "ativo" && estado !== "desativado") return;
    botao.disabled = true;
    try {
      if (estado === "ativo") await desativarNotificacoes();
      else await ativarNotificacoes();
    } catch (falha) {
      console.error(falha);
      dica.textContent = "Não foi possível mudar as notificações agora. Tente de novo.";
      dica.classList.remove("oculto");
    }
    botao.disabled = false;
    if (!dica.textContent.startsWith("Não foi possível")) await atualizar();
  });

  botaoTeste.addEventListener("click", async function () {
    botaoTeste.disabled = true;
    try {
      const r = await enviarTeste();
      dica.textContent = r.ok > 0 ? "Teste enviado. Ele deve chegar em instantes." : "Nenhum aparelho recebeu o teste. Desative e ative de novo.";
    } catch (falha) {
      console.error(falha);
      dica.textContent = "Não foi possível enviar o teste agora.";
    }
    dica.classList.remove("oculto");
    botaoTeste.disabled = false;
  });

  await atualizar();
}

if (typeof document !== "undefined") montarLinhaNotificacoes();
