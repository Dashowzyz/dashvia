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

function escapar(texto) {
  return texto.replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
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
        <button type="button" class="editar btn-editar-boleto" data-i="${i}" title="Editar boleto" aria-label="Editar ${escapar(b.g.plataforma)}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
        </button>
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

// Janela de editar o boleto.
// - Mensal: nome, valor por mês e dia do vencimento (o mesmo "Editar boleto" da tela de Parcelas).
// - Único ou parcelado: nome, valor total e a data do vencimento (no parcelado, a da 1ª parcela; as outras acompanham).
function abrirEdicaoBoleto(g) {
  const mensal = ehBoletoRecorrente(g);
  const parcelado = !mensal && Number(g.parcelas) > 1;
  const diaAtual = g.vencimento || Number(g.data.split("-")[2]);

  let campoData;
  if (mensal) {
    let opcoesDia = "";
    for (let d = 1; d <= 31; d++) {
      opcoesDia += '<option value="' + d + '"' + (d === diaAtual ? " selected" : "") + ">Dia " + d + "</option>";
    }
    campoData = '<label for="eb-dia">Dia do vencimento (todo mês)</label><select id="eb-dia">' + opcoesDia + "</select>";
  } else {
    campoData = '<label for="eb-data">' + (parcelado ? "Vencimento da 1ª parcela" : "Data do vencimento") + '</label><input type="date" id="eb-data" value="' + g.data + '">';
  }

  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML = `
    <div class="modal modal-form">
      <h3 class="modal-titulo">Editar boleto</h3>
      <form id="form-boleto" class="formulario" novalidate>
        <label for="eb-nome">Nome do boleto</label>
        <input type="text" id="eb-nome" maxlength="60" autocomplete="off">

        <label for="eb-valor">${mensal ? "Valor por mês (R$)" : parcelado ? "Valor total, somando as " + g.parcelas + " parcelas (R$)" : "Valor (R$)"}</label>
        <input type="number" id="eb-valor" step="0.01" min="0.01">

        ${campoData}

        <p class="modal-nota">${mensal ? "A mudança vale para todos os meses." : parcelado ? "As outras parcelas mudam junto com a primeira." : ""}</p>
        <p class="modal-erro" id="eb-erro"></p>
      </form>
      <div class="modal-botoes">
        <button type="button" class="modal-cancelar">Cancelar</button>
        <button type="submit" form="form-boleto" class="modal-ok salvar">Salvar</button>
      </div>
    </div>`;

  const campoNome = fundo.querySelector("#eb-nome");
  const campoValor = fundo.querySelector("#eb-valor");
  const erro = fundo.querySelector("#eb-erro");
  const botaoSalvar = fundo.querySelector(".modal-ok");
  campoNome.value = g.plataforma;
  campoValor.value = g.valor;

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

  fundo.querySelector("#form-boleto").addEventListener("submit", async function (e) {
    e.preventDefault();

    const nome = campoNome.value.trim();
    const valor = parseFloat(campoValor.value);
    if (!nome) { erro.textContent = "Digite o nome do boleto."; return; }
    if (!(valor > 0)) { erro.textContent = "Digite um valor maior que zero."; return; }

    const novo = { plataforma: nome, valor: valor };
    if (mensal) {
      novo.vencimento = Number(fundo.querySelector("#eb-dia").value);
    } else {
      const data = fundo.querySelector("#eb-data").value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) { erro.textContent = "Escolha a data do vencimento."; return; }
      novo.data = data;
      novo.vencimento = null; // boleto único/parcelado vence no dia da própria data
    }

    botaoSalvar.disabled = true;
    try {
      await atualizarGasto(g.id, novo);
    } catch (falha) {
      console.error("Erro ao editar o boleto:", falha);
      erro.textContent = "Não foi possível salvar. Tente de novo.";
      botaoSalvar.disabled = false;
      return;
    }

    Object.assign(g, novo);
    fechar();
    atualizarTela();
    mostrarAviso("Boleto atualizado.");
  });

  document.body.appendChild(fundo);
  campoNome.focus();
}

// Editar um boleto da lista
document.getElementById("proximos-boletos").addEventListener("click", function (e) {
  const botao = e.target.closest(".btn-editar-boleto");
  if (!botao) return;
  const boleto = proximosBoletos[Number(botao.dataset.i)];
  if (boleto) abrirEdicaoBoleto(boleto.g);
});

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

// ---------- Cartões de crédito: a fatura deste mês de cada banco ----------
// A pessoa arrasta para o lado para ver outro cartão. O dia de vencimento e as faturas pagas
// ficam guardados no perfil (coluna "cartoes"): { "Nubank": { vencimento: 10, pagas: ["2026-10"] } }
let configCartoes = {};
let cartoesCredito = [];
const faixaCredito = document.getElementById("faixa-cartoes-credito");
const pontosCredito = document.getElementById("pontos-cartoes-credito");
const setaCreditoAnterior = document.getElementById("cc-anterior");
const setaCreditoProxima = document.getElementById("cc-proximo");

// Mesma regra do bloco "Cartão de crédito" do topo: o que não é boleto, Pix nem à vista
function ehNoCredito(g) {
  return g.categoria !== "Boleto" && g.parcelas !== "pix" && g.parcelas !== "avista";
}

function chaveDoMes(ano, mes) {
  return ano + "-" + String(mes + 1).padStart(2, "0");
}

function dadosDoBanco(nome) {
  return BANCOS.find(function (b) { return b.nome === nome; }) || BANCOS[BANCOS.length - 1];
}

// Sugestão para o dia de vencimento: o da compra parcelada mais recente naquele banco
function vencimentoSugerido(banco) {
  const comDia = gastos.filter(function (g) { return ehNoCredito(g) && (g.banco || "Outro") === banco && g.vencimento; });
  return comDia.length ? comDia[comDia.length - 1].vencimento : 10;
}

function listarCartoesCredito() {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const chave = chaveDoMes(ano, mes);
  const porBanco = {};

  gastos.forEach(function (g) {
    if (!ehNoCredito(g)) return;
    const banco = g.banco || "Outro";

    // Todo cartão em uso aparece: com cobrança neste mês ou em algum dos próximos 12
    // (ex.: compra feita depois do vencimento, que só entra na fatura do mês que vem)
    let emUso = false;
    for (let i = 0; i <= 12 && !emUso; i++) {
      const d = new Date(ano, mes + i, 1);
      emUso = valorNoMes(g, d.getFullYear(), d.getMonth()) > 0;
    }
    if (!emUso) return;

    porBanco[banco] = (porBanco[banco] || 0) + valorNoMes(g, ano, mes);
  });

  // Cartão com vencimento já definido continua aparecendo mesmo com a fatura zerada
  Object.keys(configCartoes).forEach(function (banco) {
    if (configCartoes[banco] && configCartoes[banco].vencimento && !(banco in porBanco)) porBanco[banco] = 0;
  });

  return Object.keys(porBanco).map(function (banco) {
    const config = configCartoes[banco] || {};
    const dia = config.vencimento || null;
    const ultimoDia = new Date(ano, mes + 1, 0).getDate();
    const vence = dia ? new Date(ano, mes, Math.min(dia, ultimoDia)) : null;
    const paga = Array.isArray(config.pagas) && config.pagas.includes(chave);
    const diaDeHoje = new Date(ano, mes, hoje.getDate());

    let estado = "aberta";
    if (paga) estado = "paga";
    else if (porBanco[banco] === 0) estado = "zerada"; // sem gastos no mês: nada a pagar, então nunca "vencida"
    else if (vence && vence < diaDeHoje) estado = "vencida";

    return { banco: banco, valor: porBanco[banco], vencimento: dia, vence: vence, paga: paga, estado: estado, chave: chave };
  }).sort(function (a, b) { return (b.valor - a.valor) || a.banco.localeCompare(b.banco, "pt-BR"); });
}

const TEXTO_ESTADO_FATURA = { paga: "Paga", aberta: "Em aberto", vencida: "Vencida", zerada: "Sem gastos" };

function mostrarCartoesCredito() {
  const bloco = document.getElementById("bloco-cartoes");
  // No espaço compartilhado cada pessoa tem os próprios cartões: o bloco fica só no lado Pessoal
  cartoesCredito = escopoEscolhido() ? [] : listarCartoesCredito();
  bloco.hidden = cartoesCredito.length === 0;
  if (bloco.hidden) return;

  const nomeDoMes = hoje.toLocaleDateString("pt-BR", { month: "long" });
  document.getElementById("legenda-cartoes").textContent = "Fatura de " + nomeDoMes + " até agora";

  const indiceAntes = indiceDoCartaoCredito();

  faixaCredito.innerHTML = cartoesCredito.map(function (c, i) {
    const b = dadosDoBanco(c.banco);
    return `
      <div class="cc-item" data-i="${i}">
        <div class="cc-cartao" style="--cc-cor:${b.cor};--cc-texto:${b.texto}">
          <div class="cc-topo">
            ${iconeBanco(c.banco)}
            <span class="cc-nome">${escapar(c.banco)}</span>
            <span class="cc-chip" aria-hidden="true"></span>
          </div>
          <span class="cc-rotulo">Fatura de ${nomeDoMes}</span>
          <strong class="cc-valor">${formatarMoeda(c.valor)}</strong>
          <div class="cc-rodape">
            <span>${c.vence ? "Vence " + c.vence.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "Sem vencimento"}</span>
            <span class="cc-status ${c.estado}">${TEXTO_ESTADO_FATURA[c.estado]}</span>
          </div>
        </div>
        <div class="cc-acoes">
          <button type="button" class="cc-vencimento" data-acao="vencimento" data-i="${i}" title="Mudar o dia de vencimento">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            ${c.vencimento ? "Dia " + c.vencimento : "Vencimento"}
          </button>
          ${c.estado === "zerada" ? "" : `<button type="button" class="btn-pagar-boleto cc-pagar${c.paga ? " paga" : ""}" data-acao="pagar" data-i="${i}" aria-label="${c.paga ? "Desfazer pagamento da fatura " : "Marcar como paga a fatura "}${escapar(c.banco)}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            <span>${c.paga ? "Paga" : "Pagar"}</span>
          </button>`}
        </div>
      </div>`;
  }).join("");

  pontosCredito.innerHTML = cartoesCredito.length > 1
    ? cartoesCredito.map(function () { return "<span></span>"; }).join("")
    : "";

  irParaCartaoCredito(Math.min(indiceAntes, cartoesCredito.length - 1), false);
  marcarCartaoCredito();
  // Confere de novo depois que a tela terminou de montar (larguras finais), para a seta "›" não sumir por engano
  requestAnimationFrame(marcarCartaoCredito);
}

// Qual cartão está à mostra (o mais perto do começo da faixa)
function indiceDoCartaoCredito() {
  let melhor = 0;
  let menor = Infinity;
  faixaCredito.querySelectorAll(".cc-item").forEach(function (item, i) {
    const distancia = Math.abs(item.offsetLeft - faixaCredito.scrollLeft);
    if (distancia < menor) {
      menor = distancia;
      melhor = i;
    }
  });
  return melhor;
}

function irParaCartaoCredito(indice, suave) {
  const item = faixaCredito.querySelectorAll(".cc-item")[indice];
  if (item) faixaCredito.scrollTo({ left: item.offsetLeft, behavior: suave ? "smooth" : "auto" });
}

function marcarCartaoCredito() {
  const atual = indiceDoCartaoCredito();
  pontosCredito.querySelectorAll("span").forEach(function (ponto, i) {
    ponto.classList.toggle("ativo", i === atual);
  });

  // As setas (no computador) só aparecem se houver cartão escondido para aquele lado
  const fimDaFaixa = faixaCredito.scrollLeft + faixaCredito.clientWidth >= faixaCredito.scrollWidth - 4;
  setaCreditoAnterior.hidden = faixaCredito.scrollLeft <= 4;
  setaCreditoProxima.hidden = fimDaFaixa;
}

let esperandoCredito = false;
faixaCredito.addEventListener("scroll", function () {
  if (esperandoCredito) return;
  esperandoCredito = true;
  requestAnimationFrame(function () {
    esperandoCredito = false;
    marcarCartaoCredito();
  });
});

pontosCredito.addEventListener("click", function (e) {
  const ponto = e.target.closest("span");
  if (ponto) irParaCartaoCredito(Array.from(pontosCredito.children).indexOf(ponto), true);
});

setaCreditoAnterior.addEventListener("click", function () {
  irParaCartaoCredito(indiceDoCartaoCredito() - 1, true);
});

setaCreditoProxima.addEventListener("click", function () {
  irParaCartaoCredito(indiceDoCartaoCredito() + 1, true);
});

window.addEventListener("resize", function () {
  if (cartoesCredito.length) marcarCartaoCredito();
});

// Salva a configuração; se der errado, volta como estava
async function guardarConfigCartoes(nova, antes) {
  configCartoes = nova;
  mostrarCartoesCredito();
  try {
    await salvarCartoes(nova);
    return true;
  } catch (falha) {
    console.error("Erro ao salvar os cartões:", falha);
    configCartoes = antes;
    mostrarCartoesCredito();
    mostrarAviso("Não foi possível salvar. Tente de novo.");
    return false;
  }
}

function copiaDaConfig() {
  return JSON.parse(JSON.stringify(configCartoes));
}

// Pagar é direto (com "Desfazer" no aviso); desfazer o pagamento pede confirmação, como no boleto
async function alternarFaturaPaga(cartao) {
  const nomeDoMes = hoje.toLocaleDateString("pt-BR", { month: "long" });
  if (cartao.paga && !(await confirmar("Desfazer o pagamento da fatura " + cartao.banco + " de " + nomeDoMes + "?", "Desfazer"))) return;

  const antes = copiaDaConfig();
  const nova = copiaDaConfig();
  const config = nova[cartao.banco] || (nova[cartao.banco] = {});
  const pagas = Array.isArray(config.pagas) ? config.pagas : [];

  config.pagas = cartao.paga
    ? pagas.filter(function (m) { return m !== cartao.chave; })
    : pagas.concat(cartao.chave).slice(-12); // guarda só o último ano

  if (!(await guardarConfigCartoes(nova, antes))) return;

  if (cartao.paga) {
    mostrarAviso("Pagamento desfeito.");
    return;
  }
  mostrarAviso("Fatura " + cartao.banco + " marcada como paga.", function () {
    guardarConfigCartoes(antes, copiaDaConfig());
  });
}

// Janela para escolher o dia de vencimento da fatura
function abrirVencimentoCartao(cartao) {
  const atual = cartao.vencimento || vencimentoSugerido(cartao.banco);
  let opcoes = "";
  for (let d = 1; d <= 31; d++) {
    opcoes += '<option value="' + d + '"' + (d === atual ? " selected" : "") + ">Dia " + d + "</option>";
  }

  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML = `
    <div class="modal modal-form">
      <h3 class="modal-titulo">Vencimento do ${escapar(cartao.banco)}</h3>
      <form id="form-vencimento" class="formulario" novalidate>
        <label for="cc-dia">Dia do vencimento da fatura</label>
        <select id="cc-dia">${opcoes}</select>
        <p class="modal-nota">Vale para todos os meses. Se o mês não tiver esse dia, a fatura vence no último dia dele.</p>
      </form>
      <div class="modal-botoes">
        <button type="button" class="modal-cancelar">Cancelar</button>
        <button type="submit" form="form-vencimento" class="modal-ok salvar">Salvar</button>
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
  fundo.querySelector(".modal-cancelar").addEventListener("click", fechar);
  fundo.addEventListener("click", function (e) {
    if (e.target === fundo) fechar();
  });

  fundo.querySelector("#form-vencimento").addEventListener("submit", async function (e) {
    e.preventDefault();
    const antes = copiaDaConfig();
    const nova = copiaDaConfig();
    (nova[cartao.banco] || (nova[cartao.banco] = {})).vencimento = Number(fundo.querySelector("#cc-dia").value);
    fechar();
    if (await guardarConfigCartoes(nova, antes)) mostrarAviso("Vencimento do " + cartao.banco + " salvo.");
  });

  document.body.appendChild(fundo);
  fundo.querySelector("#cc-dia").focus();
}

faixaCredito.addEventListener("click", function (e) {
  const botao = e.target.closest("[data-acao]");
  if (!botao) return;
  const cartao = cartoesCredito[Number(botao.dataset.i)];
  if (!cartao) return;

  if (botao.dataset.acao === "pagar") alternarFaturaPaga(cartao);
  else abrirVencimentoCartao(cartao);
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
  mostrarCartoesCredito();
  mostrarProximosBoletos();
  mostrarGraficos();
  mostrarResumo();

  grafico.scrollLeft = posicao;
}

// Confere o login, busca os dados no banco e desenha a página
async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  try {
    const resultado = await Promise.all([buscarGastos(), buscarPerfil(), buscarCartoes().catch(function () { return {}; })]);
    gastos = resultado[0];
    perfilAtual = resultado[1];
    configCartoes = resultado[2];
  } catch (falha) {
    console.error(falha);
    document.getElementById("saudacao").textContent = "Não foi possível carregar seus gastos. Atualize a página.";
    return;
  }

  carregarBlocos(usuario);
  mostrarSaudacao();
  mostrarCards();
  mostrarCartoesCredito();
  mostrarProximosBoletos();
  mostrarGraficos();
  mostrarResumo();
}

iniciar();

// Ao voltar para a aba depois de um tempo, busca os gastos de novo
recarregarAoVoltar(async function () {
  gastos = await buscarGastos();
  atualizarTela();
});
