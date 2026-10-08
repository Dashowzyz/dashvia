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

// Cards do topo: gastos do mês selecionado
function mostrarCards() {
  const doMes = gastos.map(function (g) {
    return { g: g, valor: valorNoMes(g, mesSelecionado.ano, mesSelecionado.mes) };
  }).filter(function (item) { return item.valor > 0; });

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

  const nomeDoMes = new Date(mesSelecionado.ano, mesSelecionado.mes, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  document.getElementById("titulo-cards").textContent = "Gastos de " + nomeDoMes;
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
          ${g.categoria === "Assinatura"
            ? `<a class="editar" href="assinaturas.html" title="Ver nas assinaturas" aria-label="Ver nas assinaturas"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg></a>`
            : g.categoria === "Boleto" ? ""
            : `<button class="editar" data-id="${g.id}" title="Editar gasto"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>`}
          <button class="remover" data-id="${g.id}" title="Remover gasto">✕</button>
        </div>
      </li>`;
  }).join("");
}

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
});

// Redesenha tudo mantendo a rolagem do Resumo onde estava
function atualizarTela() {
  const grafico = document.getElementById("grafico");
  const posicao = grafico.scrollLeft;

  mostrarCards();
  mostrarHistorico();
  mostrarResumo();

  grafico.scrollLeft = posicao;
}

// Listas usadas no formulário de edição (as mesmas da página de adicionar)
const listaBancos = BANCOS.map(function (b) { return b.nome; }); // vem do bancos.js

// Banco digitado pela pessoa em "Outro" entra na lista da edição, para não ser trocado ao salvar
function bancosDaEdicao(atual) {
  if (!atual || listaBancos.includes(atual)) return listaBancos;
  return listaBancos.slice(0, -1).concat([atual, "Outro"]);
}
const listaParcelas = [["pix", "Pix"], ["avista", "Sem parcelas"]].concat(
  Array.from({ length: 11 }, function (_, i) { return [String(i + 2), (i + 2) + "x"]; })
);
const listaPeriodos = [["mensal", "Mensal"], ["trimestral", "Trimestral"], ["anual", "Anual"]];
const listaDias = Array.from({ length: 31 }, function (_, i) { return [i + 1, "Dia " + (i + 1)]; });

function montarOpcoes(lista, atual) {
  return lista.map(function (item) {
    const valor = Array.isArray(item) ? item[0] : item;
    const texto = Array.isArray(item) ? item[1] : item;
    const marcado = String(valor) === String(atual) ? " selected" : "";
    return '<option value="' + valor + '"' + marcado + ">" + texto + "</option>";
  }).join("");
}

// Janela para editar um gasto
function abrirEdicao(g) {
  // Categorias padrão + as que a pessoa criou (a deste gasto já está entre elas)
  const personalizadas = categoriasPersonalizadas(gastos.map(function (x) { return x.categoria; }));
  const categoriasDoGasto = CATEGORIAS_PADRAO.filter(function (c) { return c !== "Boleto"; }).concat(personalizadas);
  const eAssinatura = g.categoria === "Assinatura";

  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML = `
    <div class="modal modal-form">
      <h3 class="modal-titulo">Editar gasto</h3>
      <form id="form-editar" class="formulario" novalidate>
        <label for="ed-plataforma">Plataforma ou loja</label>
        <input type="text" id="ed-plataforma" autocomplete="off">

        <label for="ed-categoria">Categoria</label>
        <select id="ed-categoria">${montarOpcoes(categoriasDoGasto.concat([[NOVA_CATEGORIA, "+ Nova categoria"]]), g.categoria)}</select>

        <div id="ed-grupo-nova" class="oculto">
          <label for="ed-nova-categoria">Nome da nova categoria</label>
          <input type="text" id="ed-nova-categoria" maxlength="30" placeholder="Ex: Academia" autocomplete="off">
        </div>

        <label for="ed-parcelas" id="ed-rotulo-parcelas">${eAssinatura ? "Periodicidade" : "Parcelas"}</label>
        <select id="ed-parcelas">${montarOpcoes(eAssinatura ? listaPeriodos : listaParcelas, g.parcelas)}</select>

        <label for="ed-data">Data da compra</label>
        <input type="date" id="ed-data">

        <label for="ed-valor">Valor (R$)</label>
        <input type="number" id="ed-valor" step="0.01" min="0.01">

        <div id="ed-grupo-venc">
          <label for="ed-venc" id="ed-rotulo-venc">${eAssinatura ? "Dia da cobrança" : "Dia do vencimento da parcela"}</label>
          <select id="ed-venc">${montarOpcoes(listaDias, g.vencimento || 1)}</select>
        </div>

        <label for="ed-banco">Banco</label>
        <select id="ed-banco">${montarOpcoes(bancosDaEdicao(g.banco), g.banco || "Outro")}</select>

        <p class="modal-erro" id="ed-erro"></p>
      </form>
      <div class="modal-botoes">
        <button type="button" class="modal-cancelar">Cancelar</button>
        <button type="submit" form="form-editar" class="modal-ok salvar">Salvar</button>
      </div>
    </div>`;

  const campoPlataforma = fundo.querySelector("#ed-plataforma");
  const campoParcelas = fundo.querySelector("#ed-parcelas");
  const grupoVenc = fundo.querySelector("#ed-grupo-venc");
  const erro = fundo.querySelector("#ed-erro");

  campoPlataforma.value = g.plataforma;
  fundo.querySelector("#ed-data").value = g.data;
  fundo.querySelector("#ed-valor").value = g.valor;

  // Pix e "sem parcelas" não têm vencimento
  function atualizarVencimento() {
    const semVenc = campoParcelas.value === "pix" || campoParcelas.value === "avista" || fundo.querySelector("#ed-categoria").value === "Assinatura";
    grupoVenc.classList.toggle("oculto", semVenc);
  }
  campoParcelas.addEventListener("change", atualizarVencimento);
  atualizarVencimento();

  // Trocar a categoria para Assinatura muda "Parcelas" para "Periodicidade"
  const campoCategoria = fundo.querySelector("#ed-categoria");
  campoCategoria.addEventListener("change", function () {
    const assinatura = campoCategoria.value === "Assinatura";

    // "+ Nova categoria": aparece a caixa para digitar o nome
    const criandoNova = campoCategoria.value === NOVA_CATEGORIA;
    fundo.querySelector("#ed-grupo-nova").classList.toggle("oculto", !criandoNova);
    if (criandoNova) fundo.querySelector("#ed-nova-categoria").focus();

    campoParcelas.innerHTML = montarOpcoes(assinatura ? listaPeriodos : listaParcelas, "");
    fundo.querySelector("#ed-rotulo-parcelas").textContent = assinatura ? "Periodicidade" : "Parcelas";
    fundo.querySelector("#ed-rotulo-venc").textContent = assinatura ? "Dia da cobrança" : "Dia do vencimento da parcela";
    atualizarVencimento();
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

  fundo.querySelector("#form-editar").addEventListener("submit", async function (e) {
    e.preventDefault();

    const plataforma = campoPlataforma.value.trim();
    const data = fundo.querySelector("#ed-data").value;
    const valor = parseFloat(fundo.querySelector("#ed-valor").value);

    if (!plataforma) { erro.textContent = "Preencha a plataforma ou loja."; return; }
    if (!data) { erro.textContent = "Escolha a data da compra."; return; }
    if (!(valor > 0)) { erro.textContent = "Digite um valor maior que zero."; return; }

    let categoriaFinal = fundo.querySelector("#ed-categoria").value;
    if (categoriaFinal === NOVA_CATEGORIA) {
      const resultado = validarNovaCategoria(fundo.querySelector("#ed-nova-categoria").value, CATEGORIAS_PADRAO.concat(personalizadas));
      if (!resultado.ok) { erro.textContent = resultado.erro; return; }
      categoriaFinal = resultado.nome;
    }

    const semVenc = campoParcelas.value === "pix" || campoParcelas.value === "avista" || fundo.querySelector("#ed-categoria").value === "Assinatura";

    const campos = {
      plataforma: plataforma,
      categoria: categoriaFinal,
      parcelas: campoParcelas.value,
      data: data,
      valor: valor,
      vencimento: semVenc ? null : Number(fundo.querySelector("#ed-venc").value),
      banco: fundo.querySelector("#ed-banco").value
    };

    try {
      await atualizarGasto(g.id, campos);
    } catch (falha) {
      console.error(falha);
      erro.textContent = "Não foi possível salvar. Tente de novo.";
      return;
    }

    Object.assign(g, campos);
    fechar();
    atualizarTela();
  });

  document.body.appendChild(fundo);
  campoPlataforma.focus();
}

// Editar um gasto do histórico
document.getElementById("historico").addEventListener("click", function (evento) {
  const botao = evento.target.closest(".editar");
  if (!botao) return;

  const id = Number(botao.dataset.id);
  const gasto = gastos.find(function (g) { return g.id === id; });
  if (gasto && gasto.categoria !== "Assinatura") abrirEdicao(gasto);
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
  mostrarHistorico();
  mostrarResumo();
}

iniciar();

// Ao voltar para a aba depois de um tempo, busca os gastos de novo
recarregarAoVoltar(async function () {
  gastos = await buscarGastos();
  atualizarTela();
});
