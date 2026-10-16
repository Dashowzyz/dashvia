// Gastos e perfil vêm do banco de dados (Supabase), carregados em iniciar() no fim do arquivo
let gastos = [];
let perfilAtual = null;

// Blocos fixos do topo (a ordem aqui é a ordem na tela).
// As categorias que a pessoa criar entram logo depois deles.
const BLOCOS_FIXOS = [
  { id: "credito", nome: "Cartão de crédito" },
  { id: "pix", nome: "Pix" },
  { id: "alimentacao", nome: "Alimentação", categoria: "Alimentação" },
  { id: "compras", nome: "Compras", categoria: "Compras" },
  { id: "transportes", nome: "Transportes", categoria: "Transportes" },
  { id: "boleto", nome: "Boleto", categoria: "Boleto" },
  { id: "outros", nome: "Outros", categoria: "Outros" }
];
let blocosOcultos = [];
let chaveBlocos = "dashvia:blocos";            // lista antiga (guardava os blocos visíveis)
let chaveOcultos = "dashvia:blocos-ocultos";   // lista nova (guarda os blocos escondidos)

// Mês selecionado no Resumo (começa no mês atual)
const hoje = new Date();
let mesSelecionado = { ano: hoje.getFullYear(), mes: hoje.getMonth() };

function formatarMoeda(numero) {
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(texto) {
  const [ano, mes, dia] = texto.split("-");
  return dia + "/" + mes + "/" + ano;
}

function escapar(texto) {
  return texto.replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function textoParcelas(parcelas) {
  if (parcelas === "pix") return "Pix";
  if (parcelas === "avista") return "À vista";
  if (parcelas === "mensal") return "Mensal";
  if (parcelas === "trimestral") return "Trimestral";
  if (parcelas === "anual") return "Anual";
  return parcelas + "x";
}

function mostrarSaudacao() {
  const hora = new Date().getHours();
  let texto = "boa noite!";
  if (hora < 12) texto = "bom dia!";
  else if (hora < 18) texto = "boa tarde!";

  // Usa o primeiro nome do perfil (se tiver)
  const primeiroNome = ((perfilAtual && perfilAtual.nome) || "").trim().split(" ")[0];
  const temNome = !!primeiroNome;

  document.getElementById("saudacao").textContent = temNome
    ? "Olá, " + primeiroNome + ", " + texto
    : "Olá, " + texto;
}

// ---------- Cartões do topo ----------
// Ficam em páginas de 4 blocos e a pessoa arrasta para o lado para ver as outras.
const cartoes = document.getElementById("cards");
const pontosCartoes = document.getElementById("pontos-cards");
const setaAnterior = document.getElementById("cards-anterior");
const setaProxima = document.getElementById("cards-proximo");

// Formas de pagamento + categorias (as padrão e as que a pessoa criou)
function listarBlocos() {
  const personalizadas = categoriasPersonalizadas(gastos.map(function (g) { return g.categoria; }));
  return BLOCOS_FIXOS.concat(personalizadas.map(function (nome) {
    return { id: "cat:" + nome, nome: nome, categoria: nome };
  }));
}

function valorDoBloco(bloco, doMes) {
  function somar(filtro) {
    return doMes.filter(function (item) { return filtro(item.g); }).reduce(function (total, item) { return total + item.valor; }, 0);
  }

  if (bloco.id === "credito") return somar(function (g) { return g.categoria !== "Boleto" && g.parcelas !== "pix" && g.parcelas !== "avista"; });
  if (bloco.id === "pix") return somar(function (g) { return g.parcelas === "pix"; });
  return somar(function (g) { return g.categoria === bloco.categoria; });
}

// Qual página dos cartões está à mostra (a mais perto do começo da faixa)
function paginaAtualDosCartoes() {
  let melhor = 0;
  let menor = Infinity;
  cartoes.querySelectorAll(".cards-pagina").forEach(function (pagina, i) {
    const distancia = Math.abs(pagina.offsetLeft - cartoes.scrollLeft);
    if (distancia < menor) {
      menor = distancia;
      melhor = i;
    }
  });
  return melhor;
}

function irParaPaginaDosCartoes(indice, suave) {
  const pagina = cartoes.querySelectorAll(".cards-pagina")[indice];
  if (pagina) cartoes.scrollTo({ left: pagina.offsetLeft, behavior: suave ? "smooth" : "auto" });
}

function marcarPontoDosCartoes() {
  const atual = paginaAtualDosCartoes();
  pontosCartoes.querySelectorAll("span").forEach(function (ponto, i) {
    ponto.classList.toggle("ativo", i === atual);
  });

  // As setas (no computador) só aparecem se houver para onde ir
  const totalPaginasCartoes = pontosCartoes.children.length;
  setaAnterior.hidden = totalPaginasCartoes <= 1 || atual <= 0;
  setaProxima.hidden = totalPaginasCartoes <= 1 || atual >= totalPaginasCartoes - 1;
}

// Gastos que pesam no mês selecionado, com o valor daquele mês
function gastosDoMes() {
  return gastos.map(function (g) {
    return { g: g, valor: valorNoMes(g, mesSelecionado.ano, mesSelecionado.mes) };
  }).filter(function (item) { return item.valor > 0; });
}

function nomeDoMesSelecionado() {
  return new Date(mesSelecionado.ano, mesSelecionado.mes, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

// Cards do topo: gastos do mês selecionado
function mostrarCards() {
  const doMes = gastosDoMes();

  let blocos = listarBlocos().filter(function (b) { return !blocosOcultos.includes(b.id); });
  if (blocos.length === 0) {
    // Se tudo ficou escondido (ex.: a categoria que sobrou foi apagada), volta a mostrar todos
    blocosOcultos = [];
    guardarBlocos();
    blocos = listarBlocos();
  }

  const paginaAntes = paginaAtualDosCartoes();
  let paginas = "";

  for (let i = 0; i < blocos.length; i += 4) {
    paginas += '<div class="cards-pagina">' + blocos.slice(i, i + 4).map(function (b) {
      return '<div class="card" data-card="' + escapar(b.id) + '">' +
        "<strong>" + formatarMoeda(valorDoBloco(b, doMes)) + "</strong>" +
        "<span>" + escapar(b.nome) + "</span></div>";
    }).join("") + "</div>";
  }

  cartoes.innerHTML = paginas;

  const totalPaginas = Math.ceil(blocos.length / 4);
  pontosCartoes.innerHTML = totalPaginas > 1
    ? Array.from({ length: totalPaginas }, function () { return "<span></span>"; }).join("")
    : "";

  // Continua na mesma página ao trocar de mês
  irParaPaginaDosCartoes(Math.min(paginaAntes, totalPaginas - 1), false);
  marcarPontoDosCartoes();

  document.getElementById("titulo-cards").textContent = "Gastos de " + nomeDoMesSelecionado();
}

// ---------- Gráficos (mês selecionado) ----------
// Cores das categorias: cada categoria tem sempre a mesma cor (pela posição na lista, não pelo valor).
// A ordem foi escolhida para dar para diferenciar vizinhas, inclusive para quem tem daltonismo.
// Há uma versão para fundo escuro e outra para fundo claro (a pessoa pode escolher o fundo).
const CORES_GRAFICO = {
  escuro: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
  claro: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
};
const COR_DEMAIS = "#898781";

function coresDoGrafico() {
  const esquema = getComputedStyle(document.documentElement).colorScheme;
  return esquema === "light" ? CORES_GRAFICO.claro : CORES_GRAFICO.escuro;
}

function porcentagem(parte, total) {
  return Math.round(parte / total * 100) + "%";
}

// Rosca: quanto cada categoria pesou no mês
function mostrarRosca(doMes) {
  const area = document.getElementById("grafico-categorias");
  const cores = coresDoGrafico();
  const ordem = CATEGORIAS_PADRAO.concat(categoriasPersonalizadas(gastos.map(function (g) { return g.categoria; })));

  // Até 8 categorias têm cor própria; o resto entra em "Demais"
  const fatias = ordem.slice(0, cores.length).map(function (nome, i) {
    return { nome: nome, cor: cores[i], valor: 0 };
  });
  const demais = { nome: "Demais", cor: COR_DEMAIS, valor: 0 };

  doMes.forEach(function (item) {
    const chave = normalizarNome(item.g.categoria);
    const i = ordem.findIndex(function (nome) { return normalizarNome(nome) === chave; });
    (i >= 0 && i < fatias.length ? fatias[i] : demais).valor += item.valor;
  });

  const lista = fatias.concat(demais).filter(function (f) { return f.valor > 0; });
  const total = lista.reduce(function (soma, f) { return soma + f.valor; }, 0);

  if (total === 0) {
    area.innerHTML = '<p class="vazio grafico-vazio">Sem gastos neste mês.</p>';
    return;
  }

  // Cada fatia é um pedaço do mesmo círculo (pathLength 100 = a volta inteira), com um respiro entre elas
  const respiro = lista.length > 1 ? 0.6 : 0;
  let andado = 0;
  const arcos = lista.map(function (f, i) {
    const tamanho = f.valor / total * 100;
    const visivel = Math.max(tamanho - respiro, 0.01);
    const arco = '<circle class="rosca-fatia" data-i="' + i + '" cx="60" cy="60" r="48" pathLength="100" ' +
      'stroke="' + f.cor + '" stroke-dasharray="' + visivel + " " + (100 - visivel) + '" stroke-dashoffset="' + (-andado) + '"></circle>';
    andado += tamanho;
    return arco;
  }).join("");

  const legenda = lista
    .map(function (f, i) { return { f: f, i: i }; })
    .sort(function (a, b) { return b.f.valor - a.f.valor; })
    .map(function (item) {
      return '<li data-i="' + item.i + '" tabindex="0">' +
        '<i style="background:' + item.f.cor + '"></i>' +
        '<span class="rosca-nome">' + escapar(item.f.nome) + "</span>" +
        "<strong>" + formatarMoeda(item.f.valor) + "</strong>" +
        "<small>" + porcentagem(item.f.valor, total) + "</small></li>";
    }).join("");

  area.innerHTML =
    '<div class="rosca">' +
      '<svg viewBox="0 0 120 120" role="img" aria-label="Gastos por categoria">' +
        '<g transform="rotate(-90 60 60)">' + arcos + "</g></svg>" +
      '<div class="rosca-centro"><small>Total</small><strong>' + formatarMoeda(total) + "</strong></div>" +
    "</div>" +
    '<ul class="rosca-legenda">' + legenda + "</ul>";

  area._fatias = lista;
  area._total = total;
}

// Ao passar o mouse (ou focar) numa fatia ou na legenda, ela fica em destaque e o centro mostra o valor dela
function realcarFatia(area, indice) {
  const centro = area.querySelector(".rosca-centro");
  if (!centro) return;

  area.querySelectorAll("[data-i]").forEach(function (el) {
    el.classList.toggle("realcada", el.dataset.i === indice);
  });
  area.classList.toggle("com-realce", indice !== null);

  const f = indice !== null ? area._fatias[Number(indice)] : null;
  centro.innerHTML = f
    ? "<small>" + escapar(f.nome) + "</small><strong>" + formatarMoeda(f.valor) + "</strong><small>" + porcentagem(f.valor, area._total) + "</small>"
    : "<small>Total</small><strong>" + formatarMoeda(area._total) + "</strong>";
}

const areaRosca = document.getElementById("grafico-categorias");
["mouseover", "focusin"].forEach(function (tipo) {
  areaRosca.addEventListener(tipo, function (e) {
    const alvo = e.target.closest("[data-i]");
    realcarFatia(areaRosca, alvo ? alvo.dataset.i : null);
  });
});
["mouseleave", "focusout"].forEach(function (tipo) {
  areaRosca.addEventListener(tipo, function () { realcarFatia(areaRosca, null); });
});

// Barras: quanto foi em cada forma de pagamento (o crédito aparece separado por banco)
function mostrarPagamento(doMes) {
  const lista = document.getElementById("grafico-pagamento");
  const formas = {};

  doMes.forEach(function (item) {
    const g = item.g;
    let nome, icone;
    if (g.categoria === "Boleto") { nome = "Boleto"; icone = "Boleto"; }
    else if (g.parcelas === "pix") { nome = "Pix"; icone = "Pix"; }
    else if (g.parcelas === "avista") { nome = "À vista"; icone = "Outro"; }
    else { nome = "Crédito " + (g.banco || "Outro"); icone = g.banco || "Outro"; }

    if (!formas[nome]) formas[nome] = { nome: nome, icone: icone, valor: 0 };
    formas[nome].valor += item.valor;
  });

  const linhas = Object.values(formas).sort(function (a, b) { return b.valor - a.valor; });
  if (linhas.length === 0) {
    lista.innerHTML = '<li class="vazio grafico-vazio">Sem gastos neste mês.</li>';
    return;
  }

  const maior = linhas[0].valor;
  const total = linhas.reduce(function (soma, l) { return soma + l.valor; }, 0);

  lista.innerHTML = linhas.map(function (l) {
    return '<li title="' + escapar(l.nome) + ": " + formatarMoeda(l.valor) + " (" + porcentagem(l.valor, total) + ' do mês)">' +
      '<div class="barra-topo">' + iconeBanco(l.icone) +
        '<span class="barra-nome">' + escapar(l.nome) + "</span>" +
        "<strong>" + formatarMoeda(l.valor) + "</strong></div>" +
      '<div class="barra-trilho"><i style="width:' + Math.max(l.valor / maior * 100, 2) + '%"></i></div></li>';
  }).join("");
}

function mostrarGraficos() {
  const doMes = gastosDoMes();
  const legenda = "Gastos de " + nomeDoMesSelecionado();
  document.getElementById("legenda-categorias").textContent = legenda;
  document.getElementById("legenda-pagamento").textContent = legenda;
  mostrarRosca(doMes);
  mostrarPagamento(doMes);
}

// Os pontinhos acompanham a página e também levam até ela
let esperandoCartoes = false;
cartoes.addEventListener("scroll", function () {
  if (esperandoCartoes) return;
  esperandoCartoes = true;
  requestAnimationFrame(function () {
    esperandoCartoes = false;
    marcarPontoDosCartoes();
  });
});

pontosCartoes.addEventListener("click", function (e) {
  const ponto = e.target.closest("span");
  if (!ponto) return;
  irParaPaginaDosCartoes(Array.from(pontosCartoes.children).indexOf(ponto), true);
});

// No celular o dedo já arrasta; no computador a pessoa usa as setas dos lados (arrastar com o mouse dava problema)
setaAnterior.addEventListener("click", function () {
  irParaPaginaDosCartoes(paginaAtualDosCartoes() - 1, true);
});

setaProxima.addEventListener("click", function () {
  irParaPaginaDosCartoes(paginaAtualDosCartoes() + 1, true);
});
// A escolha dos blocos fica guardada neste aparelho, separada por conta.
// Guardamos os blocos ESCONDIDOS: assim, uma categoria nova já aparece sozinha.
function carregarBlocos(usuario) {
  chaveBlocos = "dashvia:blocos:" + usuario.id;
  chaveOcultos = "dashvia:blocos-ocultos:" + usuario.id;

  try {
    const ocultos = JSON.parse(localStorage.getItem(chaveOcultos));
    if (Array.isArray(ocultos)) {
      blocosOcultos = ocultos;
      return;
    }

    // Quem escolheu antes: converte a lista antiga (blocos visíveis) para a nova
    const antigos = JSON.parse(localStorage.getItem(chaveBlocos));
    if (Array.isArray(antigos) && antigos.length) {
      blocosOcultos = BLOCOS_FIXOS.map(function (b) { return b.id; }).filter(function (id) {
        return !antigos.includes(id);
      });
    }
  } catch (falha) {
    // sem armazenamento local: mostra todos
  }
}

function guardarBlocos() {
  try {
    localStorage.setItem(chaveOcultos, JSON.stringify(blocosOcultos));
  } catch (falha) {
    // sem armazenamento local: vale só até fechar a página
  }
}

// Janela para escolher quais blocos aparecem
function abrirPersonalizar() {
  const blocos = listarBlocos();

  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML = `
    <div class="modal modal-form">
      <h3 class="modal-titulo">Blocos do topo</h3>
      <p class="modal-nota">Escolha o que você quer ver. Você pode mudar quando quiser.</p>
      <div class="escolha-cards">
        ${blocos.map(function (b) {
          return '<label class="escolha-card"><input type="checkbox" value="' + escapar(b.id) + '"' +
            (blocosOcultos.includes(b.id) ? "" : " checked") + "><span>" + escapar(b.nome) + "</span></label>";
        }).join("")}
      </div>
      <p class="modal-erro" id="pc-erro"></p>
      <div class="modal-botoes">
        <button type="button" class="modal-cancelar">Cancelar</button>
        <button type="button" class="modal-ok salvar">Salvar</button>
      </div>
    </div>`;

  const erro = fundo.querySelector("#pc-erro");

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
  fundo.querySelectorAll("input").forEach(function (campo) {
    campo.addEventListener("change", function () { erro.textContent = ""; });
  });

  fundo.querySelector(".modal-ok").addEventListener("click", function () {
    const marcados = Array.from(fundo.querySelectorAll("input:checked")).map(function (c) { return c.value; });
    if (marcados.length === 0) {
      erro.textContent = "Deixe pelo menos um bloco marcado.";
      return;
    }

    blocosOcultos = blocos.map(function (b) { return b.id; }).filter(function (id) {
      return !marcados.includes(id);
    });
    guardarBlocos();
    mostrarCards();
    fechar();
  });

  document.body.appendChild(fundo);

  // Com mais de 5 blocos, a lista passa a rolar (mostra 5 e o resto fica na rolagem)
  const listaBlocos = fundo.querySelector(".escolha-cards");
  const itensBlocos = listaBlocos.querySelectorAll(".escolha-card");
  if (itensBlocos.length > 5) {
    listaBlocos.classList.add("rolavel");
    listaBlocos.style.maxHeight = (itensBlocos[4].offsetTop + itensBlocos[4].offsetHeight - itensBlocos[0].offsetTop) + "px";
  }
}

document.getElementById("btn-personalizar").addEventListener("click", abrirPersonalizar);

// Histórico: últimos 5 registros
function mostrarHistorico() {
  const lista = document.getElementById("historico");

  if (gastos.length === 0) {
    lista.innerHTML = '<li class="vazio">Nenhum gasto adicionado ainda.</li>';
    return;
  }

  const ultimos = gastos.slice().reverse().slice(0, 5);
  lista.innerHTML = ultimos.map(function (g) {
    return `
      <li>
        <span>${escapar(g.plataforma)}${autorHtml(g)}</span>
        <span>${escapar(g.categoria)}</span>
        <span>${formatarData(g.data)}</span>
        <span>${formatarMoeda(g.valor)}</span>
        <span class="tag">${g.categoria === "Boleto" && g.parcelas === "1" ? "Único" : textoParcelas(g.parcelas)}</span>
        <div class="acoes">
          ${g.categoria === "Assinatura" && !g.espacoId
            ? `<a class="editar" href="assinaturas.html" title="Ver nas assinaturas" aria-label="Ver nas assinaturas"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg></a>`
            : g.categoria === "Boleto" ? ""
            : `<button class="editar" data-id="${g.id}" title="Editar gasto"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>`}
          <button class="remover" data-id="${g.id}" title="Remover gasto">✕</button>
        </div>
      </li>`;
  }).join("");
}

// ---------- Próximos boletos: os 2 que vencem primeiro, com atalho de pagar ----------
// Mesmas regras da tela de Parcelas (parcelamento.js):
// - boleto mensal: a cobrança deste mês (ou a do mês que vem, se esta já foi paga);
// - boleto único ou parcelado: a próxima parcela que ainda não venceu e não foi paga.
function listarProximosBoletos() {
  const dia = new Date();
  dia.setHours(0, 0, 0, 0);
  const itens = [];

  gastos.forEach(function (g) {
    if (g.categoria !== "Boleto") return;

    if (ehBoletoRecorrente(g)) {
      let o = boletoAtual(g, dia);
      if (o && o.paga) o = boletoDoMes(g, o.data.getFullYear() + (o.data.getMonth() === 11 ? 1 : 0), (o.data.getMonth() + 1) % 12);
      if (o && !o.paga) itens.push({ g: g, numero: o.numero, data: o.data, valor: o.valor, nota: "Todo mês" });
      return;
    }

    if (ehParcelado(g)) {
      const todas = listarParcelas(g);
      const p = todas.find(function (x) { return !parcelaMarcadaPaga(g, x.numero) && x.data >= dia; });
      if (p) itens.push({ g: g, numero: p.numero, data: p.data, valor: p.valor, nota: todas.length === 1 ? "Boleto único" : "Parcela " + p.numero + "/" + todas.length });
    }
  });

  return itens.sort(function (a, b) { return a.data - b.data; }).slice(0, 2);
}

function prazoDoBoleto(data) {
  const dia = new Date();
  dia.setHours(0, 0, 0, 0);
  const dias = Math.round((data - dia) / 86400000);
  if (dias < 0) return { texto: "Venceu há " + (-dias) + (dias === -1 ? " dia" : " dias"), classe: "vencido" };
  if (dias === 0) return { texto: "Vence hoje", classe: "urgente" };
  if (dias === 1) return { texto: "Vence amanhã", classe: "urgente" };
  return { texto: "Vence em " + dias + " dias", classe: "" };
}

let proximosBoletos = [];

function mostrarProximosBoletos() {
  const bloco = document.getElementById("bloco-boletos");
  const lista = document.getElementById("proximos-boletos");

  // Quem não tem nenhum boleto não vê o bloco
  bloco.hidden = !gastos.some(function (g) { return g.categoria === "Boleto"; });
  proximosBoletos = listarProximosBoletos();

  if (proximosBoletos.length === 0) {
    lista.innerHTML = '<li class="vazio grafico-vazio">Nenhum boleto em aberto. Tudo pago por aqui.</li>';
    return;
  }

  lista.innerHTML = proximosBoletos.map(function (b, i) {
    const prazo = prazoDoBoleto(b.data);
    return `
      <li class="boleto-proximo ${prazo.classe}">
        ${iconeBanco("Boleto")}
        <div class="boleto-info">
          <strong>${escapar(b.g.plataforma)}</strong>
          <small>${b.nota} · ${b.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</small>
        </div>
        <div class="boleto-valor">
          <strong>${formatarMoeda(b.valor)}</strong>
          <small class="boleto-prazo">${prazo.texto}</small>
        </div>
        <button type="button" class="btn-pagar-boleto" data-i="${i}" aria-label="Marcar ${escapar(b.g.plataforma)} como pago">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Pagar</span>
        </button>
      </li>`;
  }).join("");
}

// Aviso no topo com "Desfazer" (mesmo visual da tela de Parcelas)
let avisoAtual = null;

function mostrarAviso(texto, aoDesfazer) {
  if (avisoAtual) avisoAtual.remove();

  const aviso = document.createElement("div");
  aviso.className = "aviso-parcelas";
  aviso.setAttribute("role", "status");

  const span = document.createElement("span");
  span.textContent = texto;
  aviso.appendChild(span);

  if (aoDesfazer) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = "Desfazer";
    botao.addEventListener("click", function () {
      aviso.remove();
      if (avisoAtual === aviso) avisoAtual = null;
      aoDesfazer();
    });
    aviso.appendChild(botao);
  }

  document.body.appendChild(aviso);
  avisoAtual = aviso;

  setTimeout(function () {
    aviso.remove();
    if (avisoAtual === aviso) avisoAtual = null;
  }, 8000);
}

// Pagar é direto, sem confirmação; o aviso tem "Desfazer" para o caso de um toque sem querer
document.getElementById("proximos-boletos").addEventListener("click", async function (e) {
  const botao = e.target.closest(".btn-pagar-boleto");
  if (!botao) return;

  const boleto = proximosBoletos[Number(botao.dataset.i)];
  if (!boleto) return;

  const g = boleto.g;
  const antes = g.pagasAte || 0;
  botao.disabled = true;

  try {
    await atualizarGasto(g.id, { pagasAte: boleto.numero });
  } catch (falha) {
    console.error("Erro ao registrar pagamento do boleto:", falha);
    botao.disabled = false;
    mostrarAviso("Não foi possível salvar. Tente de novo.");
    return;
  }

  g.pagasAte = boleto.numero;
  atualizarTela();

  mostrarAviso("Boleto " + g.plataforma + " marcado como pago.", async function () {
    try {
      await atualizarGasto(g.id, { pagasAte: antes });
    } catch (falha) {
      console.error("Erro ao desfazer:", falha);
      mostrarAviso("Não foi possível desfazer. Tente de novo.");
      return;
    }
    g.pagasAte = antes;
    atualizarTela();
  });
});

// Resumo: cartões dos próximos 12 meses, começando pelo mês atual, com o gasto por banco/pix
function mostrarResumo() {
  const nomesMeses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const meses = [];

  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    meses.push({ ano: d.getFullYear(), mes: d.getMonth(), total: 0, origens: {} });
  }

  gastos.forEach(function (g) {
    const origem = g.parcelas === "pix" ? "Pix" : (g.banco || "Outro");

    meses.forEach(function (item) {
      const valor = valorNoMes(g, item.ano, item.mes);
      if (valor <= 0) return;

      item.origens[origem] = (item.origens[origem] || 0) + valor;
      item.total += valor;
    });
  });

  const grafico = document.getElementById("grafico");

  grafico.innerHTML = meses.map(function (m) {
    const linhas = Object.entries(m.origens)
      .sort(function (a, b) { return b[1] - a[1]; })
      .map(function (par) {
        return `<li><strong>${formatarMoeda(par[1])}</strong><small>${iconeBanco(par[0])}<span class="origem-nome">${escapar(par[0])}</span></small></li>`;
      })
      .join("");

    const conteudo = linhas
      ? `<ul class="mes-lista">${linhas}</ul>`
      : `<p class="mes-vazio">Sem gastos</p>`;

    const selecionado = m.ano === mesSelecionado.ano && m.mes === mesSelecionado.mes;

    return `
      <div class="mes ${selecionado ? "selecionado" : ""}" data-ano="${m.ano}" data-mes="${m.mes}">
        <div class="mes-cartao">
          ${conteudo}
          <div class="mes-total">Total ${formatarMoeda(m.total)}</div>
        </div>
        <span class="mes-nome">${nomesMeses[m.mes]}</span>
      </div>`;
  }).join("");

  // Já abre mostrando o mês atual (o primeiro da fila, na esquerda)
  grafico.scrollLeft = 0;
}

// Ao clicar em um mês do Resumo, os cards do topo passam a mostrar aquele mês
document.getElementById("grafico").addEventListener("click", function (evento) {
  const cartao = evento.target.closest(".mes");
  if (!cartao) return;

  mesSelecionado = { ano: Number(cartao.dataset.ano), mes: Number(cartao.dataset.mes) };

  document.querySelectorAll(".mes").forEach(function (el) {
    el.classList.toggle("selecionado", el === cartao);
  });

  mostrarCards();
  mostrarGraficos();
});

// Redesenha tudo mantendo a rolagem do Resumo onde estava
function atualizarTela() {
  const grafico = document.getElementById("grafico");
  const posicao = grafico.scrollLeft;

  mostrarCards();
  mostrarProximosBoletos();
  mostrarHistorico();
  mostrarGraficos();
  mostrarResumo();

  grafico.scrollLeft = posicao;
}

// Listas usadas no formulário de edição (as mesmas da página de adicionar)
// Editar um gasto do histórico
document.getElementById("historico").addEventListener("click", async function (evento) {
  const botao = evento.target.closest(".editar");
  if (!botao) return;

  const id = Number(botao.dataset.id);
  const gasto = gastos.find(function (g) { return g.id === id; });
  if (gasto && (gasto.categoria !== "Assinatura" || gasto.espacoId)) {
    const opcoes = await categoriasParaEditar(gastos);
    abrirEdicao(gasto, Object.assign({ aoSalvar: atualizarTela }, opcoes));
  }
});

// Remover um gasto do histórico
document.getElementById("historico").addEventListener("click", async function (evento) {
  const botao = evento.target.closest(".remover");
  if (!botao) return;

  if (!(await confirmar("Remover este gasto?", "Remover"))) return;

  const id = Number(botao.dataset.id);

  try {
    await removerGasto(id);
  } catch (falha) {
    console.error(falha);
    alert("Não foi possível remover. Tente de novo.");
    return;
  }

  gastos = gastos.filter(function (g) { return g.id !== id; });
  atualizarTela();
});

// Confere o login, busca os dados no banco e desenha a página
async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  try {
    const resultado = await Promise.all([buscarGastos(), buscarPerfil()]);
    gastos = resultado[0];
    perfilAtual = resultado[1];
  } catch (falha) {
    console.error(falha);
    document.getElementById("historico").innerHTML =
      '<li class="vazio">Não foi possível carregar seus gastos. Atualize a página.</li>';
    return;
  }

  carregarBlocos(usuario);
  mostrarSaudacao();
  mostrarCards();
  mostrarProximosBoletos();
  mostrarHistorico();
  mostrarGraficos();
  mostrarResumo();
}

iniciar();

// Ao voltar para a aba depois de um tempo, busca os gastos de novo
recarregarAoVoltar(async function () {
  gastos = await buscarGastos();
  atualizarTela();
});
