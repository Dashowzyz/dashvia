// Novidades: lista do que mudou no Dashvia.
// Para anunciar uma atualização, é só colocar um bloco novo NO COMEÇO da lista abaixo
// (da mais nova para a mais antiga).
// "data" no formato AAAA-MM-DD. Em "itens", cada linha é uma mudança.

const NOVIDADES = [
  {
    versao: "Teste das notificações",
    data: "2026-10-09",
    etiqueta: "Teste",
    resumo: "Isto é só um teste dos avisos no aparelho. Pode ignorar.",
    itens: [
      "Agora o Dashvia avisa no aparelho quando um boleto ou parcela está perto de vencer e quando sai novidade."
    ]
  },
  {
    versao: "Início do beta teste",
    data: "2026-10-05",
    etiqueta: "Beta",
    resumo: "O Dashvia começou a fase de testes. Obrigado por fazer parte desde o início!",
    itens: [
      "Dashboard com o resumo dos próximos 12 meses.",
      "Cadastro de gastos, assinaturas e parcelas futuras.",
      "Cores e temas para deixar o site com a sua cara.",
      "Por ser uma versão beta, pode haver erros ou detalhes a melhorar. Se encontrar algo, use \"Reportar um problema\" em Configurações. Sua opinião ajuda a construir o Dashvia."
    ]
  }
];
// ----- Quais novidades a pessoa já viu (guardado neste aparelho) -----
const NOVIDADES_VISTAS_CHAVE = "dashvia:novidades-vistas";

function idNovidade(n) {
  return n.data + "|" + n.versao;
}

function novidadesVistas() {
  try {
    return JSON.parse(localStorage.getItem(NOVIDADES_VISTAS_CHAVE)) || [];
  } catch (erro) {
    return [];
  }
}

// Novidades que a pessoa ainda não abriu: são elas que fazem o sino avisar
function novidadesNaoVistas() {
  const vistas = novidadesVistas();
  return NOVIDADES.filter(function (n) { return !vistas.includes(idNovidade(n)); });
}

function marcarNovidadesVistas() {
  try {
    localStorage.setItem(NOVIDADES_VISTAS_CHAVE, JSON.stringify(NOVIDADES.map(idNovidade)));
  } catch (erro) {
    // sem armazenamento local: o aviso volta na próxima visita
  }
  if (typeof atualizarSino === "function") atualizarSino();
}

function abrirNovidades() {
  // Abrir a janela conta como "ver": o aviso do sino some
  marcarNovidadesVistas();

  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML = `
    <div class="modal modal-form">
      <h3 class="modal-titulo">Novidades</h3>
      <div class="novidades">
        ${NOVIDADES.length === 0 ? '<p class="novidades-vazio">Ainda não há novidades. Quando algo mudar, você vê aqui.</p>' : NOVIDADES.map(function (n) {
          const [ano, mes, dia] = n.data.split("-");
          return `
            <article class="novidade">
              <div class="novidade-topo">
                ${n.etiqueta ? '<span class="novidade-selo">' + n.etiqueta + "</span>" : ""}
                <span class="novidade-data">${dia}/${mes}/${ano}</span>
              </div>
              <h4>${n.versao}</h4>
              ${n.resumo ? '<p class="novidade-resumo">' + n.resumo + "</p>" : ""}
              <ul>${n.itens.map(function (item) { return "<li>" + item + "</li>"; }).join("")}</ul>
            </article>`;
        }).join("")}
      </div>
      <div class="modal-botoes">
        <button type="button" class="modal-ok salvar">Fechar</button>
      </div>
    </div>`;

  function fechar() {
    document.removeEventListener("keydown", aoTeclar);
    fundo.remove();
  }
  function aoTeclar(e) {
    if (e.key === "Escape") fechar();
  }
  document.addEventListener("keydown", aoTeclar);
  fundo.querySelector(".modal-ok").addEventListener("click", fechar);
  fundo.addEventListener("click", function (e) {
    if (e.target === fundo) fechar();
  });

  document.body.appendChild(fundo);
  fundo.querySelector(".modal-ok").focus();
}

// O botão só existe em Configurações; nas outras páginas este arquivo serve só para o aviso do sino
const botaoNovidades = document.getElementById("btn-novidades");
if (botaoNovidades) botaoNovidades.addEventListener("click", abrirNovidades);
