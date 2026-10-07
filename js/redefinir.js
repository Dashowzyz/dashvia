const form = document.getElementById("form-redefinir");
const mensagem = document.getElementById("mensagem");
const campoNova = document.getElementById("nova");
const campoConfirmar = document.getElementById("confirmar");
const botao = form.querySelector('button[type="submit"]');

// O Neon manda a pessoa de volta para esta página com ?token=... (ou ?error=... se o link não vale mais)
const parametros = new URLSearchParams(window.location.search);
const token = parametros.get("error") ? null : parametros.get("token");

// Só números
[campoNova, campoConfirmar].forEach(function (campo) {
  campo.addEventListener("input", function () {
    campo.value = campo.value.replace(/\D/g, "");
  });
});

form.addEventListener("submit", async function (evento) {
  evento.preventDefault();
  mensagem.className = "mensagem";

  const nova = campoNova.value;

  if (!/^\d{6}$/.test(nova)) {
    mensagem.textContent = "A senha precisa ter exatamente 6 números.";
    return;
  }
  if (nova !== campoConfirmar.value) {
    mensagem.textContent = "As senhas não são iguais.";
    return;
  }

  // O link do e-mail traz um código (token) no endereço da página
  if (!token) {
    mensagem.textContent = "Esse link expirou. Peça um novo em \"Esqueci minha senha\".";
    return;
  }

  botao.disabled = true;
  const { error } = await redefinirSenha(token, nova);
  botao.disabled = false;

  if (error) {
    console.error("Erro ao redefinir:", error.original);
    mensagem.textContent = error.tipo === "link_invalido"
      ? "Esse link expirou. Peça um novo em \"Esqueci minha senha\"."
      : "Não foi possível salvar a senha. Tente de novo.";
    return;
  }

  mensagem.className = "mensagem ok";
  mensagem.textContent = "Senha alterada! Indo para o login...";
  setTimeout(function () {
    window.location.href = "login.html";
  }, 1500);
});
