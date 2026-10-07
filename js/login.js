const form = document.getElementById("form-login");
const campos = document.querySelectorAll(".pin-campo");
const grupoPin = document.querySelector(".pin");
const botaoVer = document.getElementById("ver-senha");
const mensagem = document.getElementById("mensagem");

const iconeOlho = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const iconeOlhoRiscado = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.8 19.8 0 0 1 5.06-5.94M9.9 4.24A10.9 10.9 0 0 1 12 5c7 0 11 7 11 7a19.7 19.7 0 0 1-3.17 4.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

botaoVer.innerHTML = iconeOlho;

// Caixinhas da senha: só números, pulando de uma para a outra
campos.forEach(function (campo, i) {
  campo.addEventListener("input", function () {
    campo.value = campo.value.replace(/\D/g, "").slice(-1);
    mensagem.textContent = "";
    if (campo.value && i < campos.length - 1) campos[i + 1].focus();
  });

  campo.addEventListener("keydown", function (e) {
    if (e.key === "Backspace" && !campo.value && i > 0) {
      campos[i - 1].value = "";
      campos[i - 1].focus();
    }
    if (e.key === "ArrowLeft" && i > 0) campos[i - 1].focus();
    if (e.key === "ArrowRight" && i < campos.length - 1) campos[i + 1].focus();
  });

  campo.addEventListener("focus", function () {
    campo.select();
  });

  // Colar os 6 números de uma vez
  campo.addEventListener("paste", function (e) {
    e.preventDefault();
    const numeros = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    numeros.split("").forEach(function (n, j) { campos[j].value = n; });
    campos[Math.min(numeros.length, campos.length - 1)].focus();
  });
});

// Mostrar / ocultar a senha
botaoVer.addEventListener("click", function () {
  const mostrando = campos[0].type === "text";
  campos.forEach(function (c) { c.type = mostrando ? "password" : "text"; });
  botaoVer.innerHTML = mostrando ? iconeOlho : iconeOlhoRiscado;
  botaoVer.setAttribute("aria-label", mostrando ? "Mostrar senha" : "Ocultar senha");
});

// Lembrar de mim: guarda só o e-mail neste aparelho (a senha nunca é guardada)
const CHAVE_EMAIL = "dashvia:email-lembrado";
const campoEmail = document.getElementById("email");
const caixaLembrar = document.getElementById("lembrar");

try {
  const guardado = localStorage.getItem(CHAVE_EMAIL);
  if (guardado) {
    campoEmail.value = guardado;
    caixaLembrar.checked = true;
    campos[0].focus(); // o e-mail já está pronto: só falta a senha
  }
} catch (falha) {
  // sem armazenamento local: o e-mail só não fica lembrado
}

function guardarEmail(email) {
  try {
    if (caixaLembrar.checked) localStorage.setItem(CHAVE_EMAIL, email);
    else localStorage.removeItem(CHAVE_EMAIL);
  } catch (falha) {
    // sem armazenamento local: tudo bem
  }
}

// Desmarcar a caixinha esquece o e-mail na hora
caixaLembrar.addEventListener("change", function () {
  if (!caixaLembrar.checked) guardarEmail("");
});

const botaoEntrar = form.querySelector('button[type="submit"]');

form.addEventListener("submit", async function (evento) {
  evento.preventDefault();
  mensagem.className = "mensagem";

  const email = document.getElementById("email").value.trim();
  const senha = Array.from(campos).map(function (c) { return c.value; }).join("");

  if (senha.length !== 6) {
    mensagem.textContent = "Digite os 6 números da senha.";
    grupoPin.classList.remove("tremer");
    void grupoPin.offsetWidth; // reinicia a animação
    grupoPin.classList.add("tremer");
    Array.from(campos).find(function (c) { return !c.value; }).focus();
    return;
  }

  mensagem.textContent = "";
  botaoEntrar.disabled = true;
  botaoEntrar.textContent = "Entrando...";

  const { error } = await entrar(email, senha);

  if (error) {
    botaoEntrar.disabled = false;
    botaoEntrar.textContent = "Entrar";

    if (error.tipo === "nao_confirmado") {
      mensagem.textContent = "Confirme seu e-mail antes de entrar.";
    } else if (error.tipo === "credenciais") {
      mensagem.textContent = "E-mail ou senha incorretos.";
    } else {
      mensagem.textContent = "Não foi possível entrar. Tente de novo.";
    }

    grupoPin.classList.remove("tremer");
    void grupoPin.offsetWidth;
    grupoPin.classList.add("tremer");
    return;
  }

  guardarEmail(email);
  window.location.href = "dashboard.html";
});

// Quem já está logado vai direto para o dashboard
usuarioAtual().then(function (usuario) {
  if (usuario) window.location.href = "dashboard.html";
});

// Esqueci minha senha
const formRecuperar = document.getElementById("form-recuperar");
const mensagemRecuperar = document.getElementById("mensagem-recuperar");
const rodapeLogin = document.getElementById("rodape-login");
const subtitulo = document.querySelector(".subtitulo");
const textoSubtitulo = subtitulo.textContent;

document.getElementById("esqueci").addEventListener("click", function (e) {
  e.preventDefault();
  form.classList.add("oculto");
  rodapeLogin.classList.add("oculto");
  formRecuperar.classList.remove("oculto");
  subtitulo.textContent = "Informe seu e-mail para recuperar a senha";
  document.getElementById("email-recuperar").focus();
});

document.getElementById("voltar-login").addEventListener("click", function (e) {
  e.preventDefault();
  formRecuperar.classList.add("oculto");
  formRecuperar.reset();
  mensagemRecuperar.textContent = "";
  form.classList.remove("oculto");
  rodapeLogin.classList.remove("oculto");
  subtitulo.textContent = textoSubtitulo;
});

formRecuperar.addEventListener("submit", async function (e) {
  e.preventDefault();

  const email = document.getElementById("email-recuperar").value.trim();
  const endereco = new URL("redefinir.html", window.location.href).href;

  mensagemRecuperar.className = "mensagem ok";
  mensagemRecuperar.textContent = "Enviando...";

  const { error } = await pedirRecuperacao(email, endereco);

  if (error) {
    mensagemRecuperar.className = "mensagem";
    mensagemRecuperar.textContent = "Não foi possível enviar agora. Aguarde um pouco e tente de novo.";
    return;
  }

  mensagemRecuperar.textContent = "Se existir uma conta com esse e-mail, enviaremos as instruções.";
});

// Sem rolagem quando tudo cabe na tela (se não couber, a rolagem continua para não esconder nada)
function ajustarRolagem() {
  document.body.classList.remove("sem-rolagem");
  const cabe = document.documentElement.scrollHeight <= window.innerHeight + 1;
  document.body.classList.toggle("sem-rolagem", cabe);
}

ajustarRolagem();
window.addEventListener("load", ajustarRolagem);
window.addEventListener("resize", ajustarRolagem);
new ResizeObserver(ajustarRolagem).observe(document.body);
document.querySelector(".caixa-login").addEventListener("animationend", ajustarRolagem);

// Depois de excluir a conta, avisa na tela de login
if (sessionStorage.getItem("conta_excluida")) {
  sessionStorage.removeItem("conta_excluida");
  mensagem.className = "mensagem ok";
  mensagem.textContent = "Sua conta foi excluída.";
}
