const form = document.getElementById("form-cadastro");
const mensagem = document.getElementById("mensagem");
const campoSenha = document.getElementById("senha");
const campoConfirmar = document.getElementById("confirmar-senha");
const botao = form.querySelector('button[type="submit"]');

// Só deixa digitar números nos campos de senha
[campoSenha, campoConfirmar].forEach(function (campo) {
  campo.addEventListener("input", function () {
    campo.value = campo.value.replace(/\D/g, "");
  });
});

form.addEventListener("submit", async function (evento) {
  evento.preventDefault();

  const nome = document.getElementById("nome").value.trim();
  const email = document.getElementById("email").value.trim();
  const senha = campoSenha.value;
  const confirmar = campoConfirmar.value;

  mensagem.className = "mensagem";

  if (!/^\d{6}$/.test(senha)) {
    mensagem.textContent = "A senha precisa ter exatamente 6 números.";
    return;
  }

  if (senhaFraca(senha)) {
    mensagem.textContent = TEXTO_SENHA_FRACA;
    return;
  }

  if (senha !== confirmar) {
    mensagem.textContent = "As senhas não são iguais.";
    return;
  }

  if (!document.getElementById("aceite").checked) {
    mensagem.textContent = "Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.";
    return;
  }

  mensagem.textContent = "";
  botao.disabled = true;
  botao.textContent = "Criando...";

  const resposta = await cadastrar(nome, "", email, senha);

  botao.disabled = false;
  botao.textContent = "Criar conta";

  if (resposta.error) {
    const tipo = resposta.error.tipo;
    if (tipo === "ja_cadastrado") {
      mensagem.textContent = "Esse e-mail já está cadastrado.";
    } else if (tipo === "muitas_tentativas") {
      mensagem.textContent = "Muitas tentativas. Aguarde um pouco e tente de novo.";
    } else {
      mensagem.textContent = "Não foi possível criar a conta. Tente de novo.";
    }
    return;
  }

  // Sem confirmação de e-mail: já entra. Com confirmação: avisa para olhar o e-mail.
  if (!resposta.precisaConfirmar) {
    window.location.href = "dashboard.html";
    return;
  }

  mensagem.className = "mensagem ok";
  mensagem.textContent = "Conta criada!";
  // Os e-mails de confirmação costumam cair no spam: o aviso diz isso e mostra para onde o link foi
  document.getElementById("aviso-email-endereco").textContent = email;
  const aviso = document.getElementById("aviso-email");
  aviso.classList.remove("oculto");
  aviso.scrollIntoView({ behavior: "smooth", block: "nearest" });
  form.reset();
});
