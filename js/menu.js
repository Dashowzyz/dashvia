// Destaca no menu o ícone da página em que a pessoa está
// Na Cloudflare as páginas abrem sem o ".html" (/dashboard), então normaliza para o nome do arquivo
const paginaAtual = (location.pathname.split("/").pop() || "dashboard").replace(/\.html$/, "") + ".html";

document.querySelectorAll(".menu nav a").forEach(function (link) {
  const destino = link.getAttribute("href");
  link.classList.toggle("ativo", destino === paginaAtual || (paginaAtual === "espaco.html" && destino === "configuracoes.html") || (paginaAtual === "historico.html" && destino === "parcelas.html"));
});

// Caixa de confirmação no estilo do Dashvia (substitui o confirm() do navegador)
// Uso: if (await confirmar("Pergunta?", "Texto do botão")) { ... }
function confirmar(mensagem, textoConfirmar) {
  return new Promise(function (resolve) {
    const fundo = document.createElement("div");
    fundo.className = "modal-fundo";
    fundo.innerHTML =
      '<div class="modal">' +
        '<p class="modal-texto"></p>' +
        '<div class="modal-botoes">' +
          '<button type="button" class="modal-cancelar">Cancelar</button>' +
          '<button type="button" class="modal-ok"></button>' +
        '</div>' +
      '</div>';

    fundo.querySelector(".modal-texto").textContent = mensagem;
    fundo.querySelector(".modal-ok").textContent = textoConfirmar || "Confirmar";

    function fechar(resposta) {
      document.removeEventListener("keydown", aoTeclar);
      fundo.remove();
      resolve(resposta);
    }

    function aoTeclar(e) {
      if (e.key === "Escape") fechar(false);
    }

    fundo.querySelector(".modal-ok").addEventListener("click", function () { fechar(true); });
    fundo.querySelector(".modal-cancelar").addEventListener("click", function () { fechar(false); });
    fundo.addEventListener("click", function (e) {
      if (e.target === fundo) fechar(false);
    });
    document.addEventListener("keydown", aoTeclar);

    document.body.appendChild(fundo);
    fundo.querySelector(".modal-cancelar").focus();
  });
}

// Sino de notificações no topo da página.
// Hoje ele avisa quando há uma novidade nova em "Novidades" (veja novidades.js):
// o sino balança, ganha uma bolinha e o painel mostra o aviso.
const cabecalhoSino = document.querySelector(".conteudo header");

// Estilos do aviso (ficam aqui para não depender de mais nenhum arquivo)
function garantirEstilosNotificacoes() {
  if (document.getElementById("estilos-notificacoes")) return;

  const estilo = document.createElement("style");
  estilo.id = "estilos-notificacoes";
  estilo.textContent = `
    .notificacoes { list-style: none; margin: 0 0 18px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .notificacao { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; background: var(--fundo); border: 1px solid var(--borda); border-radius: 12px; }
    .notificacao-icone { display: flex; flex-shrink: 0; margin-top: 2px; color: var(--destaque); }
    .notificacao strong { display: block; font-size: 14px; color: var(--texto); font-weight: 600; }
    .notificacao small { display: block; margin-top: 2px; font-size: 12px; color: var(--texto-suave); }
    @keyframes sino-balancar {
      0%, 100% { transform: rotate(0); }
      15% { transform: rotate(14deg); }
      30% { transform: rotate(-12deg); }
      45% { transform: rotate(9deg); }
      60% { transform: rotate(-6deg); }
      75% { transform: rotate(3deg); }
    }
    .sino-topo.tem-novas svg { transform-origin: 50% 12%; animation: sino-balancar 1s ease 0.5s 3; }
  `;
  document.head.appendChild(estilo);
}

// ---------- Avisos de boleto ----------
// Cada boleto avisa em 3 momentos: 7 dias antes, 3 dias antes e no dia do vencimento.
// Mostra só o momento em que ele está agora; o aviso de cada momento conta como novo uma vez só.
let avisosBoleto = [];
const CHAVE_AVISOS_VISTOS = "dashvia:avisos-boleto-vistos";

function avisosVistos() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_AVISOS_VISTOS)) || [];
  } catch (falha) {
    return [];
  }
}

function avisosBoletoNaoVistos() {
  const vistos = avisosVistos();
  return avisosBoleto.filter(function (a) { return vistos.indexOf(a.chave) === -1; });
}

function marcarAvisosBoletoVistos() {
  const vistos = avisosVistos();
  avisosBoleto.forEach(function (a) {
    if (vistos.indexOf(a.chave) === -1) vistos.push(a.chave);
  });
  try {
    localStorage.setItem(CHAVE_AVISOS_VISTOS, JSON.stringify(vistos.slice(-200)));
  } catch (falha) {
    // sem armazenamento local: o aviso volta a aparecer como novo na próxima visita
  }
}

function montarAvisosBoleto(lista) {
  const dia = new Date();
  dia.setHours(0, 0, 0, 0);
  const avisos = [];

  lista.filter(function (g) { return g.categoria === "Boleto" && (ehParcelado(g) || ehBoletoRecorrente(g)); }).forEach(function (g) {
    // A próxima cobrança que ainda não foi paga e não venceu
    let proxima;
    if (ehBoletoRecorrente(g)) {
      // Boleto mensal: olha o mês atual e o seguinte
      const indice = dia.getFullYear() * 12 + dia.getMonth();
      for (let k = 0; k <= 1 && !proxima; k++) {
        const o = boletoDoMes(g, Math.floor((indice + k) / 12), (indice + k) % 12);
        if (o && !o.paga && o.data >= dia) proxima = o;
      }
    } else {
      proxima = listarParcelas(g).find(function (p) {
        return !parcelaMarcadaPaga(g, p.numero) && p.data >= dia;
      });
    }
    if (!proxima) return;

    const dias = Math.round((proxima.data - dia) / 86400000);
    if (dias > 7) return;

    const momento = dias === 0 ? 0 : dias <= 3 ? 3 : 7;
    const total = ehBoletoRecorrente(g) ? 0 : Number(g.parcelas);
    const quando = dias === 0 ? "vence hoje" : dias === 1 ? "vence amanhã" : "vence em " + dias + " dias";
    const parcela = total === 0 ? " · todo mês" : total > 1 ? " · parcela " + proxima.numero + "/" + total : "";

    avisos.push({
      chave: g.id + ":" + proxima.numero + ":" + momento,
      dias: dias,
      titulo: "Boleto " + g.plataforma + " " + quando,
      detalhe: proxima.data.toLocaleDateString("pt-BR") + " · " + proxima.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) + parcela
    });
  });

  return avisos.sort(function (a, b) { return a.dias - b.dias; });
}

function carregarAvisosBoleto() {
  if (typeof buscarGastos !== "function" || typeof listarParcelas !== "function") return;
  buscarGastos().then(function (lista) {
    avisosBoleto = montarAvisosBoleto(lista);
    atualizarSino();
  }).catch(function (falha) {
    console.error(falha);
  });
}

// Liga ou desliga o aviso conforme as novidades e os boletos ainda não vistos
function atualizarSino() {
  const sino = document.querySelector(".sino-topo");
  if (!sino) return;

  const quantidade = (typeof novidadesNaoVistas === "function" ? novidadesNaoVistas().length : 0) + avisosBoletoNaoVistos().length;
  sino.classList.toggle("tem-novas", quantidade > 0);
  sino.setAttribute("aria-label", quantidade > 0 ? "Notificações (" + quantidade + " nova" + (quantidade > 1 ? "s" : "") + ")" : "Notificações");

  // Se o CSS do site não desenha a bolinha, desenha aqui
  if (quantidade > 0 && !document.getElementById("estilo-bolinha-sino")) {
    const conteudo = getComputedStyle(sino, "::after").content;
    if (!conteudo || conteudo === "none" || conteudo === "normal") {
      const estilo = document.createElement("style");
      estilo.id = "estilo-bolinha-sino";
      estilo.textContent =
        ".sino-topo { position: relative; } " +
        ".sino-topo.tem-novas::after { content: ''; position: absolute; top: 7px; right: 7px; width: 10px; height: 10px; border-radius: 50%; background: #ff4d6d; border: 2px solid var(--fundo); }";
      document.head.appendChild(estilo);
    }
  }
}

// A lista de novidades fica em novidades.js; nas páginas que não carregam esse arquivo, ele é buscado aqui
function carregarNovidades(depois) {
  if (typeof NOVIDADES !== "undefined") {
    depois();
    return;
  }
  const script = document.createElement("script");
  script.src = "js/novidades.js?v=20261008g";
  script.onload = depois;
  document.head.appendChild(script);
}

function escaparNotificacao(texto) {
  return String(texto).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

if (cabecalhoSino) {
  garantirEstilosNotificacoes();

  const sino = document.createElement("button");
  sino.type = "button";
  sino.className = "sino-topo";
  sino.title = "Notificações";
  sino.setAttribute("aria-label", "Notificações");
  sino.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  sino.addEventListener("click", abrirNotificacoes);
  cabecalhoSino.appendChild(sino);

  carregarNovidades(atualizarSino);
  carregarAvisosBoleto();
}

function abrirNotificacoes() {
  garantirEstilosNotificacoes();

  const novas = typeof novidadesNaoVistas === "function" ? novidadesNaoVistas() : [];
  const iconeBoleto = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" x2="4" y1="5" y2="19"/><line x1="8" x2="8" y1="5" y2="19"/><line x1="12" x2="12" y1="5" y2="19"/><line x1="16" x2="16" y1="5" y2="19"/><line x1="20" x2="20" y1="5" y2="19"/></svg>';
  const iconeNovidade = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4"/><path d="M17 5h4"/></svg>';

  const itens =
    avisosBoleto.map(function (a) {
      return '<li class="notificacao"><span class="notificacao-icone">' + iconeBoleto + '</span>' +
        '<div><strong>' + escaparNotificacao(a.titulo) + '</strong><small>' + escaparNotificacao(a.detalhe) + '</small></div></li>';
    }).concat(novas.map(function (n) {
      return '<li class="notificacao"><span class="notificacao-icone">' + iconeNovidade + '</span>' +
        '<div><strong>Tem coisa nova nas Novidades</strong><small>' + escaparNotificacao(n.versao) + '</small></div></li>';
    }));

  const conteudo = itens.length === 0
    ? '<p class="modal-nota">Você não tem notificações por enquanto.</p>'
    : '<ul class="notificacoes">' + itens.join("") + '</ul>';

  // O botão principal leva para onde há algo novo: as novidades ou, se só houver boletos, as parcelas
  const acaoPrincipal = novas.length > 0 ? "ver" : avisosBoleto.length > 0 ? "boletos" : "";
  const botoes = !acaoPrincipal
    ? '<button type="button" class="modal-ok salvar" data-acao="fechar">Fechar</button>'
    : '<button type="button" class="modal-cancelar" data-acao="fechar">Fechar</button>' +
      '<button type="button" class="modal-ok salvar" data-acao="' + acaoPrincipal + '">' + (acaoPrincipal === "ver" ? "Ver novidades" : "Ver boletos") + '</button>';

  // Abrir a lista conta como ter visto os avisos de boleto: o sino para de chamar atenção
  marcarAvisosBoletoVistos();
  atualizarSino();
  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML =
    '<div class="modal modal-form">' +
      '<h3 class="modal-titulo">Notificações</h3>' +
      conteudo +
      '<div class="modal-botoes">' + botoes + '</div>' +
    '</div>';

  function fechar() {
    document.removeEventListener("keydown", aoTeclar);
    fundo.remove();
  }
  function aoTeclar(e) {
    if (e.key === "Escape") fechar();
  }
  document.addEventListener("keydown", aoTeclar);

  fundo.querySelectorAll("[data-acao]").forEach(function (botao) {
    botao.addEventListener("click", function () {
      fechar();
      if (botao.dataset.acao === "ver" && typeof abrirNovidades === "function") abrirNovidades();
      if (botao.dataset.acao === "boletos") window.location.href = "parcelas.html";
    });
  });
  fundo.addEventListener("click", function (e) {
    if (e.target === fundo) fechar();
  });

  document.body.appendChild(fundo);
  fundo.querySelector(".modal-ok").focus();
}

// A foto no topo do menu: a da pessoa ou, se não tiver, a imagem padrão do Dashvia
function mostrarFotoNoMenu(foto) {
  const logoMenu = document.querySelector(".menu .logo");
  if (!logoMenu) return;
  logoMenu.textContent = "";
  logoMenu.style.backgroundImage = "url(" + (foto || "img/avatar-padrao.jpg") + ")";
  logoMenu.style.backgroundSize = "cover";
  logoMenu.style.backgroundPosition = "center";
}

// Antes de carregar o perfil já aparece a imagem padrão, para o "D" de texto não piscar
mostrarFotoNoMenu("");

// Foto de perfil no menu e bolinha no topo da página (celular), vindas do banco
if (typeof buscarPerfil === "function") {
  buscarPerfil().then(function (perfil) {
    if (!perfil) return;

    // Cores da conta (valem em qualquer aparelho)
    if (perfil.tema !== undefined && typeof aplicarTema === "function") {
      guardarTema(perfil.tema || {});
      aplicarTema(perfil.tema || {});
    }

    // Foto da pessoa no lugar do "D" do menu (sem foto, fica a imagem padrão)
    mostrarFotoNoMenu(perfil.foto);

    // Bolinha no topo (só aparece no celular, pelo CSS)
    const cabecalhoPagina = document.querySelector(".conteudo header");
    if (cabecalhoPagina && paginaAtual !== "configuracoes.html") {
      const bolinha = document.createElement("div");
      bolinha.className = "avatar-topo";

      bolinha.style.backgroundImage = "url(" + (perfil.foto || "img/avatar-padrao.jpg") + ")";

      cabecalhoPagina.appendChild(bolinha);
    }
  }).catch(function (falha) {
    console.error(falha);
  });
}

// Adicionar gasto e Configurações: sem rolagem quando tudo cabe na tela.
// Se não couber (tela pequena ou um painel aberto), a rolagem continua para não esconder nada.
if (paginaAtual === "adicionar.html" || paginaAtual === "configuracoes.html") {
  const ajustarRolagem = function () {
    document.body.classList.remove("sem-rolagem");
    const cabe = document.documentElement.scrollHeight <= window.innerHeight + 1;
    document.body.classList.toggle("sem-rolagem", cabe);
  };

  ajustarRolagem();
  window.addEventListener("load", ajustarRolagem);
  window.addEventListener("resize", ajustarRolagem);
  new ResizeObserver(ajustarRolagem).observe(document.body);
}

// Celular: ao rolar para baixo o menu desce e some; ao rolar para cima (ou no fim da página) ele volta
{
  const barraMenu = document.querySelector(".menu");
  const celular = window.matchMedia("(max-width: 700px)");
  let ultimoY = window.scrollY;
  let esperando = false;

  const atualizarMenu = function () {
    esperando = false;
    const y = Math.max(window.scrollY, 0);
    const diferenca = y - ultimoY;
    const noFim = window.innerHeight + y >= document.documentElement.scrollHeight - 8;

    if (!celular.matches || y < 60 || noFim) {
      barraMenu.classList.remove("menu-escondido");
    } else if (diferenca > 6) {
      barraMenu.classList.add("menu-escondido");
    } else if (diferenca < -6) {
      barraMenu.classList.remove("menu-escondido");
    }

    if (Math.abs(diferenca) > 6) ultimoY = y;
  };

  if (barraMenu) {
    window.addEventListener("scroll", function () {
      if (!esperando) {
        esperando = true;
        requestAnimationFrame(atualizarMenu);
      }
    }, { passive: true });
  }
}