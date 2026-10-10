// Perfil e conta vêm do banco de dados (Supabase)
let perfil = { nome: "", email: "", foto: "" };

const toast = document.getElementById("toast");
let temporizadorToast;
const avatar = document.getElementById("avatar");
const inputFoto = document.getElementById("input-foto");
const paineis = document.querySelectorAll(".painel");

// Notificação flutuante no topo da tela
function mostrarAviso(texto, tipo) {
  toast.textContent = texto;
  toast.className = "toast mostrar " + tipo;

  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(function () {
    toast.classList.remove("mostrar");
  }, 3500);
}

function falhou(falha) {
  console.error(falha);
  mostrarAviso("Não foi possível salvar. Tente de novo.", "erro");
}

// Dados sensíveis ocultos: a escolha fica guardada neste aparelho
const ICONE_OLHO = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>';
const ICONE_OLHO_FECHADO = '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>';
const MASCARA = "••••••••";
let ocultarDados = false;
try {
  ocultarDados = localStorage.getItem("dashvia:ocultar-dados") === "1";
} catch (falha) {
  // sem armazenamento local: começa mostrando
}

function mostrarPerfil() {
  const nome = perfil.nome || "Usuário";
  document.getElementById("perfil-nome").textContent = ocultarDados && perfil.nome ? MASCARA : nome;
  document.getElementById("valor-nome").textContent = ocultarDados && perfil.nome ? MASCARA : (perfil.nome || "—");
  document.getElementById("valor-email").textContent = ocultarDados && perfil.email ? MASCARA : (perfil.email || "—");

  const botaoOlho = document.getElementById("btn-olho");
  const rotulo = ocultarDados ? "Mostrar dados sensíveis" : "Ocultar dados sensíveis";
  botaoOlho.setAttribute("aria-pressed", String(ocultarDados));
  botaoOlho.title = rotulo;
  botaoOlho.setAttribute("aria-label", rotulo);
  document.getElementById("icone-olho").innerHTML = ocultarDados ? ICONE_OLHO_FECHADO : ICONE_OLHO;

  if (perfil.foto) {
    avatar.style.backgroundImage = "url(" + perfil.foto + ")";
    avatar.textContent = "";
  } else {
    avatar.style.backgroundImage = "url(img/avatar-padrao.jpg)";
    avatar.textContent = "";
  }

  document.getElementById("btn-remover-foto").classList.toggle("oculto", !perfil.foto);
}

document.getElementById("btn-olho").addEventListener("click", function () {
  ocultarDados = !ocultarDados;
  try {
    localStorage.setItem("dashvia:ocultar-dados", ocultarDados ? "1" : "0");
  } catch (falha) {
    // sem armazenamento local: vale só nesta visita
  }
  mostrarPerfil();
});

function fecharPaineis() {
  paineis.forEach(function (p) {
    p.classList.add("oculto");
    p.reset();
  });
  document.querySelectorAll(".linha.aberta").forEach(function (linha) {
    linha.classList.remove("aberta");
  });
}

// Abre o painel da linha clicada (e fecha os outros)
document.querySelectorAll(".linha[data-painel]").forEach(function (botao) {
  botao.addEventListener("click", function () {
    const painel = document.getElementById(botao.dataset.painel);
    const estavaOculto = painel.classList.contains("oculto");
    fecharPaineis();
    if (estavaOculto) {
      painel.classList.remove("oculto");
      botao.classList.add("aberta");
      painel.querySelector("input").focus();
    }
  });
});

// Foto de perfil: reduz a imagem antes de salvar
document.getElementById("btn-foto").addEventListener("click", function () {
  inputFoto.click();
});

document.getElementById("btn-remover-foto").addEventListener("click", async function () {
  if (!(await confirmar("Remover sua foto de perfil?", "Remover"))) return;

  try {
    perfil = await salvarPerfil({ foto: "" });
  } catch (falha) {
    falhou(falha);
    return;
  }

  mostrarPerfil();
  mostrarAviso("Foto removida.", "ok");
});

inputFoto.addEventListener("change", function () {
  const arquivo = inputFoto.files[0];
  if (!arquivo) return;

  const leitor = new FileReader();
  leitor.onload = function () {
    const imagem = new Image();
    imagem.onload = async function () {
      const tamanho = 200;
      const canvas = document.createElement("canvas");
      canvas.width = tamanho;
      canvas.height = tamanho;

      // Recorta o quadrado do centro da imagem
      const lado = Math.min(imagem.width, imagem.height);
      const x = (imagem.width - lado) / 2;
      const y = (imagem.height - lado) / 2;
      canvas.getContext("2d").drawImage(imagem, x, y, lado, lado, 0, 0, tamanho, tamanho);

      try {
        perfil = await salvarPerfil({ foto: canvas.toDataURL("image/jpeg", 0.85) });
      } catch (falha) {
        falhou(falha);
        return;
      }

      mostrarPerfil();
      mostrarAviso("Foto atualizada!", "ok");
    };
    imagem.src = leitor.result;
  };
  leitor.readAsDataURL(arquivo);
  inputFoto.value = "";
});

document.getElementById("painel-nome").addEventListener("submit", async function (e) {
  e.preventDefault();
  const nome = document.getElementById("novo-nome").value.trim();
  if (!nome) return;

  try {
    perfil = await salvarPerfil({ nome: nome });
  } catch (falha) {
    falhou(falha);
    return;
  }

  mostrarPerfil();
  fecharPaineis();
  mostrarAviso("Nome atualizado!", "ok");
});

document.getElementById("painel-email").addEventListener("submit", async function (e) {
  e.preventDefault();
  const email = document.getElementById("novo-email").value.trim();

  if (email.toLowerCase() === String(perfil.email || "").toLowerCase()) {
    mostrarAviso("Esse já é o seu e-mail atual.", "erro");
    return;
  }

  const { error } = await alterarEmail(email);

  if (error) {
    if (error.tipo === "ja_cadastrado") {
      mostrarAviso("Esse e-mail já está em uso em outra conta.", "erro");
    } else if (String(error.original && error.original.message).toLowerCase().includes("change email is disabled")) {
      mostrarAviso("A troca de e-mail ainda não está disponível.", "erro");
    } else if (error.tipo === "muitas_tentativas") {
      mostrarAviso("Muitas tentativas. Aguarde um pouco e tente de novo.", "erro");
    } else {
      falhou(error.original);
    }
    return;
  }

  fecharPaineis();
  mostrarAviso("Enviamos um link de confirmação para o novo e-mail.", "ok");
});

// Senhas: só números
document.querySelectorAll("#painel-senha input").forEach(function (campo) {
  campo.addEventListener("input", function () {
    campo.value = campo.value.replace(/\D/g, "");
  });
});

document.getElementById("painel-senha").addEventListener("submit", async function (e) {
  e.preventDefault();

  const atual = document.getElementById("senha-atual").value;
  const nova = document.getElementById("senha-nova").value;
  const confirmar = document.getElementById("senha-confirmar").value;

  if (!atual) {
    mostrarAviso("Digite a senha atual.", "erro");
    return;
  }
  if (!/^\d{6}$/.test(nova)) {
    mostrarAviso("A nova senha precisa ter exatamente 6 números.", "erro");
    return;
  }
  if (senhaFraca(nova)) {
    mostrarAviso(TEXTO_SENHA_FRACA, "erro");
    return;
  }
  if (nova !== confirmar) {
    mostrarAviso("As senhas não são iguais.", "erro");
    return;
  }

  // alterarSenha() confere a senha atual antes de trocar
  const { error } = await alterarSenha(atual, nova);
  if (error) {
    if (error.tipo === "credenciais") {
      mostrarAviso("A senha atual está incorreta.", "erro");
    } else {
      falhou(error.original);
    }
    return;
  }

  fecharPaineis();
  mostrarAviso("Senha alterada!", "ok");
});

document.getElementById("btn-sair").addEventListener("click", async function () {
  if (await confirmar("Deseja mesmo sair da conta?", "Sair")) {
    await sair();
  }
});

// ----- Aparência: cores escolhidas pela pessoa -----
let tema = temaGuardado();

const camposCor = {
  fundo: document.getElementById("cor-fundo"),
  menu: document.getElementById("cor-menu"),
  destaque: document.getElementById("cor-destaque"),
  texto: document.getElementById("cor-texto")
};

// Mostra nos seletores as cores que estão valendo agora
function mostrarCores() {
  const atuais = coresEfetivas(tema);
  Object.keys(camposCor).forEach(function (chave) {
    camposCor[chave].value = atuais[chave];
    document.getElementById("hex-" + chave).textContent = atuais[chave].toUpperCase();
  });
}

// Testa uma cor nova. Se trocar o fundo e as letras escolhidas não combinarem mais,
// as letras voltam para o automático em vez de travar a pessoa.
function resolverCor(chave, valor) {
  const candidato = Object.assign({}, tema);
  candidato[chave] = valor;

  let ajustouLetras = false;
  let resultado = validarTema(candidato);

  if (!resultado.ok && chave === "fundo" && tema.texto) {
    delete candidato.texto;
    ajustouLetras = true;
    resultado = validarTema(candidato);
  }

  return { tema: candidato, ok: resultado.ok, motivo: resultado.motivo, ajustouLetras: ajustouLetras };
}

async function salvarTema() {
  guardarTema(tema);
  try {
    perfil = await salvarPerfil({ tema: Object.keys(tema).length ? tema : null });
  } catch (falha) {
    falhou(falha);
  }
}

// Valida a cor escolhida de verdade e salva
async function confirmarCor(chave, valor) {
  const r = resolverCor(chave, valor);

  if (!r.ok) {
    aplicarTema(tema);
    mostrarCores();
    mostrarAviso(r.motivo, "erro");
    return;
  }

  tema = r.tema;
  aplicarTema(tema);
  mostrarCores();
  mostrarAviso(r.ajustouLetras ? "Ajustei a cor das letras para continuar legível." : "Cores atualizadas!", "ok");
  await salvarTema();
}

// Ao tocar numa linha de cor, abre o seletor do Dashvia (seletor-cor.js) no lugar da janela do aparelho
Object.keys(camposCor).forEach(function (chave) {
  const campo = camposCor[chave];

  campo.addEventListener("click", function (e) {
    e.preventDefault(); // não deixa abrir a janela de cor do Android/Chrome
    abrirSeletorCor({
      cor: campo.value,
      // enquanto a pessoa arrasta a bolinha, mostra a cor ao vivo (só se for legível)
      aoMudar: function (hex) {
        const r = resolverCor(chave, hex);
        if (r.ok) aplicarTema(r.tema);
      },
      aoConfirmar: function (hex) { confirmarCor(chave, hex); },
      aoCancelar: function () { aplicarTema(tema); }
    });
  });
});

document.getElementById("btn-restaurar-cores").addEventListener("click", async function () {
  if (!(await confirmar("Restaurar as cores padrão? Suas cores escolhidas serão perdidas.", "Restaurar"))) return;

  tema = {};
  aplicarTema(tema);
  mostrarCores();
  mostrarAviso("Cores padrão restauradas.", "ok");
  await salvarTema();
});

// Excluir a conta: pede a senha e apaga tudo no banco
function abrirExclusao() {
  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML = `
    <div class="modal modal-form">
      <h3 class="modal-titulo">Excluir conta</h3>
      <p class="modal-texto">Isso apaga <strong>para sempre</strong> a sua conta e <strong>todos os seus dados</strong>: perfil e foto, cores do tema, gastos, parcelas, assinaturas e as notificações ativadas nos seus aparelhos. Não dá para desfazer.</p>
      <p class="modal-nota">Se você participa de um espaço compartilhado, os gastos que você lançou nele continuam para as outras pessoas, sem o seu nome.</p>
      <div class="formulario">
        <label for="ex-senha">Digite sua senha para confirmar</label>
        <input type="password" id="ex-senha" inputmode="numeric" maxlength="6" placeholder="000000">
      </div>
      <p class="modal-erro" id="ex-erro"></p>
      <div class="modal-botoes">
        <button type="button" class="modal-cancelar">Cancelar</button>
        <button type="button" class="modal-ok">Excluir conta</button>
      </div>
    </div>`;

  const campoSenha = fundo.querySelector("#ex-senha");
  const erro = fundo.querySelector("#ex-erro");
  const botaoExcluir = fundo.querySelector(".modal-ok");

  campoSenha.addEventListener("input", function () {
    campoSenha.value = campoSenha.value.replace(/\D/g, "");
    erro.textContent = "";
  });

  function fechar() {
    document.removeEventListener("keydown", aoTeclar);
    fundo.remove();
  }
  function aoTeclar(e) {
    if (e.key === "Escape") fechar();
  }
  document.addEventListener("keydown", aoTeclar);
  fundo.querySelector(".modal-cancelar").addEventListener("click", fechar);
  fundo.addEventListener("click", function (e) {
    if (e.target === fundo) fechar();
  });

  botaoExcluir.addEventListener("click", async function () {
    if (!/^\d{6}$/.test(campoSenha.value)) {
      erro.textContent = "Digite a senha de 6 números.";
      return;
    }

    botaoExcluir.disabled = true;
    botaoExcluir.textContent = "Excluindo...";

    // Confere a senha e apaga tudo
    const { error } = await excluirConta(perfil.email, campoSenha.value);
    if (error) {
      if (error.tipo === "credenciais") {
        erro.textContent = "Senha incorreta.";
      } else if (error.tipo === "lider") {
        erro.textContent = "Você lidera um espaço compartilhado. Passe a liderança para outra pessoa antes de excluir a conta.";
      } else {
        console.error(error.original);
        erro.textContent = "Não foi possível excluir. Tente de novo.";
      }
      botaoExcluir.disabled = false;
      botaoExcluir.textContent = "Excluir conta";
      return;
    }

    sessionStorage.setItem("conta_excluida", "1");
    window.location.href = "login.html";
  });

  document.body.appendChild(fundo);
  campoSenha.focus();
}

document.getElementById("btn-excluir").addEventListener("click", abrirExclusao);

// Refazer o tour guiado (começa no Dashboard)
document.getElementById("btn-tour").addEventListener("click", function () {
  if (typeof iniciarTour === "function") iniciarTour();
});

// Reportar um problema: o relato chega por e-mail (serviço Web3Forms).
// Cole abaixo a chave que o Web3Forms envia para o seu e-mail ao se cadastrar.
const CHAVE_REPORTE = "c039903a-cac9-4685-888d-9dcc3d584e2f";
const ESPERA_REPORTE = 60 * 1000; // uma pessoa só pode enviar 1 relato por minuto

function abrirReporte() {
  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML = `
    <div class="modal modal-form">
      <h3 class="modal-titulo">Reportar um problema</h3>
      <form id="form-reporte" class="formulario" novalidate>
        <label for="rp-texto">O que aconteceu?</label>
        <textarea id="rp-texto" rows="6" maxlength="1500" placeholder="Conte o que você estava fazendo e o que deu errado."></textarea>
        <p class="modal-nota">Junto com o seu relato enviamos seu e-mail e o navegador que você usa, para podermos te responder e entender o problema.</p>
        <p class="modal-erro" id="rp-erro"></p>
      </form>
      <div class="modal-botoes">
        <button type="button" class="modal-cancelar">Cancelar</button>
        <button type="submit" form="form-reporte" class="modal-ok salvar">Enviar</button>
      </div>
    </div>`;

  const campoTexto = fundo.querySelector("#rp-texto");
  const erro = fundo.querySelector("#rp-erro");
  const botaoEnviar = fundo.querySelector(".modal-ok");

  campoTexto.addEventListener("input", function () {
    erro.textContent = "";
  });

  function fechar() {
    document.removeEventListener("keydown", aoTeclar);
    fundo.remove();
  }
  function aoTeclar(e) {
    if (e.key === "Escape") fechar();
  }
  document.addEventListener("keydown", aoTeclar);
  fundo.querySelector(".modal-cancelar").addEventListener("click", fechar);
  fundo.addEventListener("click", function (e) {
    if (e.target === fundo) fechar();
  });

  fundo.querySelector("#form-reporte").addEventListener("submit", async function (e) {
    e.preventDefault();

    const texto = campoTexto.value.trim();
    if (texto.length < 10) {
      erro.textContent = "Conte um pouco mais (pelo menos 10 letras).";
      return;
    }

    if (CHAVE_REPORTE.indexOf("COLE_") === 0) {
      erro.textContent = "O envio de relatos ainda não foi configurado.";
      return;
    }

    let ultimoEnvio = 0;
    try {
      ultimoEnvio = Number(localStorage.getItem("dashvia:reporte")) || 0;
    } catch (falha) {
      // sem armazenamento local: segue sem a espera
    }
    if (Date.now() - ultimoEnvio < ESPERA_REPORTE) {
      erro.textContent = "Você acabou de enviar um relato. Aguarde um minuto para enviar outro.";
      return;
    }

    botaoEnviar.disabled = true;
    botaoEnviar.textContent = "Enviando...";

    try {
      const resposta = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          access_key: CHAVE_REPORTE,
          subject: "Dashvia · Relato de problema",
          from_name: "Dashvia",
          name: perfil.nome || "Usuário",
          email: perfil.email,
          message: texto,
          navegador: navigator.userAgent,
          tela: window.innerWidth + "x" + window.innerHeight,
          enviado_em: new Date().toLocaleString("pt-BR")
        })
      });
      const dados = await resposta.json();
      if (!resposta.ok || !dados.success) throw new Error(dados.message || "Falha no envio");
    } catch (falha) {
      console.error(falha);
      erro.textContent = "Não foi possível enviar agora. Tente de novo em instantes.";
      botaoEnviar.disabled = false;
      botaoEnviar.textContent = "Enviar";
      return;
    }

    try {
      localStorage.setItem("dashvia:reporte", String(Date.now()));
    } catch (falha) {
      // sem armazenamento local: tudo bem
    }

    fechar();
    mostrarAviso("Obrigado! Recebemos o seu relato.", "ok");
  });

  document.body.appendChild(fundo);
  campoTexto.focus();
}

document.getElementById("btn-reporte").addEventListener("click", abrirReporte);

// Confere o login e carrega o perfil
async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  try {
    perfil = await buscarPerfil();
  } catch (falha) {
    console.error(falha);
  }

  // As cores da conta valem sobre as guardadas neste aparelho
  if (perfil && perfil.tema !== undefined) {
    tema = limparTema(perfil.tema);
    guardarTema(tema);
    aplicarTema(tema);
  }

  mostrarPerfil();
  mostrarCores();

  // Mostra o nome do espaço compartilhado (ou que ainda não participa de nenhum)
  meuEspaco().then(function (espaco) {
    const valor = document.getElementById("valor-espaco");
    if (valor) valor.textContent = espaco ? espaco.nome : "Criar ou entrar";
  });
}

iniciar();
