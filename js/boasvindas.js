// Caixa de boas-vindas: aparece uma única vez, quando a conta é nova.
// O botão começa o tour guiado (tour.js) na mesma hora.
(async function () {
  const DIAS_DE_CONTA_NOVA = 7; // só contas criadas nesse prazo ganham a caixa

  let usuario;
  try {
    usuario = await usuarioAtual();
  } catch (falha) {
    return;
  }
  if (!usuario) return;

  // Já viu? Então não mostra de novo (a marca fica guardada neste aparelho)
  const chave = "dashvia:boas-vindas:" + usuario.id;
  try {
    if (localStorage.getItem(chave)) return;
  } catch (falha) {
    return; // sem armazenamento local não dá para lembrar, então é melhor não mostrar
  }

  function marcarComoVista() {
    try {
      localStorage.setItem(chave, "1");
    } catch (falha) {
      // tudo bem
    }
  }

  // Conta antiga: não mostra, só marca para não conferir de novo
  const criadaEm = new Date(usuario.createdAt);
  if (isNaN(criadaEm.getTime()) || Date.now() - criadaEm.getTime() > DIAS_DE_CONTA_NOVA * 86400000) {
    marcarComoVista();
    return;
  }

  let primeiroNome = "";
  try {
    const perfil = await buscarPerfil();
    primeiroNome = ((perfil && perfil.nome) || "").trim().split(/\s+/)[0];
  } catch (falha) {
    // sem nome, a saudação fica sem ele
  }

  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML =
    '<div class="modal modal-form">' +
      '<h3 class="modal-titulo"></h3>' +
      '<p class="modal-texto">Sua conta está pronta. Em poucos passos você aprende a registrar gastos, ' +
      'acompanhar parcelas e assinaturas e deixar o Dashvia com a sua cara.</p>' +
      '<div class="modal-botoes">' +
        '<button type="button" class="modal-cancelar">Agora não</button>' +
        '<button type="button" class="modal-ok salvar">Fazer o tour</button>' +
      '</div>' +
    '</div>';

  fundo.querySelector(".modal-titulo").textContent =
    primeiroNome ? "Bem-vindo ao Dashvia, " + primeiroNome + "!" : "Bem-vindo ao Dashvia!";

  function fechar() {
    document.removeEventListener("keydown", aoTeclar);
    fundo.remove();
  }
  function aoTeclar(e) {
    if (e.key === "Escape") fechar();
  }
  document.addEventListener("keydown", aoTeclar);

  fundo.querySelector(".modal-cancelar").addEventListener("click", fechar);
  fundo.querySelector(".modal-ok").addEventListener("click", function () {
    fechar();
    if (typeof iniciarTour === "function") iniciarTour();
    else if (typeof abrirGuia === "function") abrirGuia();
  });
  fundo.addEventListener("click", function (e) {
    if (e.target === fundo) fechar();
  });

  document.body.appendChild(fundo);
  fundo.querySelector(".modal-ok").focus();
  marcarComoVista();
})();
