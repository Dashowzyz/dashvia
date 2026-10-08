// Parcelas futuras: as compras parceladas (2x ou mais), separadas por banco.
// Os bancos aparecem como cartões que a pessoa arrasta para o lado;
// embaixo ficam as compras do banco que está no centro.
let gastos = [];
let grupos = [];
let bancoSelecionado = null;
let estruturaPerdida = false; // vira true quando a tela de "nenhuma parcela" substitui os cartões
let bancoFavorito = null; // o cartão que a pessoa favoritou aparece primeiro

const faixa = document.getElementById("faixa-cartoes");
const pontos = document.getElementById("pontos");
const listaParcelas = document.getElementById("lista-parcelas");
const textoResumo = document.getElementById("resumo-parcelas");
const areaParcelas = document.getElementById("area-parcelas");

function formatarMoeda(numero) {
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data) {
  return data.toLocaleDateString("pt-BR");
}

function escapar(texto) {
  return String(texto == null ? "" : texto).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// Agrupa por banco só as compras que ainda têm parcelas para pagar
function montarGrupos() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const porBanco = {};

  gastos.filter(ehParcelado).forEach(function (g) {
    const todas = listarParcelas(g);
    // Falta pagar: a parcela ainda não venceu e a pessoa não marcou como paga (pagasAte = última parcela paga)
    const faltam = todas.filter(function (p) { return !parcelaMarcadaPaga(g, p.numero) && p.data >= hoje; });
    if (faltam.length === 0) return;

    const banco = g.banco || "Outro";
    if (!porBanco[banco]) porBanco[banco] = { banco: banco, restante: 0, proxima: null, compras: [] };
    const grupo = porBanco[banco];

    const restante = faltam.reduce(function (soma, p) { return soma + p.valor; }, 0);
    grupo.compras.push({
      g: g,
      total: todas.length,
      pagas: todas.length - faltam.length,
      proxima: faltam[0],
      restante: restante,
      faltam: faltam
    });
    grupo.restante += restante;
    if (!grupo.proxima || faltam[0].data < grupo.proxima) grupo.proxima = faltam[0].data;
  });

  // Boleto residencial: fica para sempre; mostra a cobrança do mês, com o status (pago ou não)
  gastos.filter(ehBoletoRecorrente).forEach(function (g) {
    const o = boletoAtual(g, hoje);
    if (!o) return;

    if (!porBanco.Boleto) porBanco.Boleto = { banco: "Boleto", restante: 0, proxima: null, compras: [] };
    const grupo = porBanco.Boleto;
    const restante = o.paga ? 0 : o.valor;

    grupo.compras.push({
      g: g,
      recorrente: true,
      ocorrencia: o,
      proxima: { numero: o.numero, data: o.data, valor: o.valor },
      restante: restante
    });
    grupo.restante += restante;
    if (!grupo.proxima || o.data < grupo.proxima) grupo.proxima = o.data;
  });

  grupos = Object.keys(porBanco).map(function (b) { return porBanco[b]; });
  // O favorito vem primeiro; os outros ficam do maior valor restante para o menor
  grupos.sort(function (a, b) {
    // No espaço compartilhado o Boleto vem primeiro e os cartões ficam depois
    if (espacoDaTela && (a.banco === "Boleto") !== (b.banco === "Boleto")) return a.banco === "Boleto" ? -1 : 1;
    if (bancoFavorito && !espacoDaTela) {
      if (a.banco === bancoFavorito) return -1;
      if (b.banco === bancoFavorito) return 1;
    }
    return b.restante - a.restante;
  });
  grupos.forEach(function (gr) {
    // Os já pagos vão para o fim; o resto fica por data de vencimento
    gr.compras.sort(function (a, b) {
      const pagaA = a.recorrente && a.ocorrencia.paga ? 1 : 0;
      const pagaB = b.recorrente && b.ocorrencia.paga ? 1 : 0;
      return (pagaA - pagaB) || (a.proxima.data - b.proxima.data);
    });
  });
}

const ICONE_ESTRELA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

// Marca ou desmarca o favorito (só existe um). A ordem dos cartões muda na próxima vez que a página abrir.
async function alternarFavorito(banco) {
  const anterior = bancoFavorito;
  bancoFavorito = anterior === banco ? null : banco;
  atualizarEstrelas();

  try {
    await salvarBancoFavorito(bancoFavorito);
  } catch (falha) {
    console.error("Erro ao salvar o favorito:", falha);
    bancoFavorito = anterior;
    atualizarEstrelas();

    const textoAntes = textoResumo.textContent;
    textoResumo.textContent = "Não foi possível salvar o favorito. Tente de novo.";
    setTimeout(function () { textoResumo.textContent = textoAntes; }, 4000);
  }
}

function atualizarEstrelas() {
  faixa.querySelectorAll(".cartao-banco").forEach(function (cartao) {
    const ativo = cartao.dataset.banco === bancoFavorito;
    const botao = cartao.querySelector(".cartao-favorito");
    botao.classList.toggle("ativo", ativo);
    botao.setAttribute("aria-pressed", String(ativo));
    botao.title = ativo ? "Favorito: abre primeiro" : "Favoritar: abrir este cartão primeiro";
  });
}

const ICONE_PAGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

function textoCompras(quantidade, boleto) {
  if (boleto) return quantidade + (quantidade === 1 ? " boleto" : " boletos");
  return quantidade + (quantidade === 1 ? " compra" : " compras");
}

function desenharCartoes() {
  faixa.innerHTML = grupos.map(function (gr) {
    const proxima = gr.proxima.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `
      <div class="cartao-banco${gr.banco === "Boleto" ? " cartao-boleto" : ""}" data-banco="${escapar(gr.banco)}">
        <button type="button" class="cartao-favorito${gr.banco === bancoFavorito ? " ativo" : ""}" aria-pressed="${gr.banco === bancoFavorito}" aria-label="Favoritar ${escapar(gr.banco)}" title="${gr.banco === bancoFavorito ? "Favorito: abre primeiro" : "Favoritar: abrir este cartão primeiro"}">${ICONE_ESTRELA}</button>
        <span class="cartao-nome">${iconeBanco(gr.banco)}${escapar(gr.banco)}</span>
        <span class="cartao-rotulo">Falta pagar</span>
        <strong class="cartao-valor">${formatarMoeda(gr.restante)}</strong>
        <div class="cartao-rodape">
          <span>${textoCompras(gr.compras.length, gr.banco === "Boleto")}</span>
          <span>Próxima: ${proxima}</span>
        </div>
      </div>`;
  }).join("");

  pontos.innerHTML = grupos.length > 1
    ? grupos.map(function () { return "<span></span>"; }).join("")
    : "";
}

// No grupo Boleto, cada item ganha o visual de boleto (ficha com canhoto), pintado com as cores do tema
function classeItemBoleto(c) {
  if (bancoSelecionado !== "Boleto") return "";
  const dia = new Date();
  dia.setHours(0, 0, 0, 0);
  let estado = "aberto";
  if (c.recorrente) {
    const o = c.ocorrencia;
    estado = o.paga ? "pago" : o.data < dia ? "vencido" : "aberto";
  } else if (c.proxima && c.proxima.data < dia) {
    estado = "vencido";
  }
  return " item-boleto st-" + estado;
}

function rotuloBoleto(texto) {
  return bancoSelecionado === "Boleto" ? '<span class="boleto-rotulo">' + texto + "</span>" : "";
}
// Boleto que se repete todo mês: a cobrança do mês com o status (Pago, Em aberto ou Vencido)
function itemBoletoMensal(c) {
  const o = c.ocorrencia;
  const dia = new Date();
  dia.setHours(0, 0, 0, 0);
  const vencido = !o.paga && o.data < dia;
  const status = o.paga ? "Pago" : vencido ? "Vencido" : "Em aberto";
  const classe = o.paga ? "pago" : vencido ? "vencido" : "aberto";
  const nomeBotao = o.paga ? "Desfazer pagamento de " : "Marcar como pago: ";

  return `
      <li class="item-parcela${classeItemBoleto(c)}">
        <div class="item-inicial">${escapar(c.g.plataforma.trim().charAt(0).toUpperCase())}</div>
        <div class="item-info">
          ${rotuloBoleto("Beneficiário")}<strong>${escapar(c.g.plataforma)}</strong>${autorHtml(c.g)}
          <small style="display:flex;flex-wrap:wrap;gap:0 8px"><span style="white-space:nowrap">${c.g.canceladoEm ? "Encerra após este mês" : "Todo mês"}</span><span style="white-space:nowrap">vence ${formatarData(o.data)}</span></small>
          <span class="status-boleto ${classe}">${status}</span>
          <div class="acoes-boleto">
            <button type="button" class="link-boleto" data-acao="editar" data-id="${c.g.id}">Editar</button>
            ${c.g.canceladoEm ? "" : `<button type="button" class="link-boleto" data-acao="encerrar" data-id="${c.g.id}">Encerrar</button>`}
          </div>
        </div>
        <div class="item-valores">
          ${rotuloBoleto("Valor")}
          <strong>${formatarMoeda(o.valor)}</strong>
          <small>${o.paga ? "Mês pago" : "Deste mês"}</small>
        </div>
        <button type="button" class="item-pagar${o.paga ? " paga" : ""}" data-id="${c.g.id}" aria-label="${nomeBotao}${escapar(c.g.plataforma)}" title="${o.paga ? "Pago. Toque para desfazer" : "Marcar como pago"}">${ICONE_PAGO}</button>
      </li>`;
}

function mostrarLista() {
  const grupo = grupos.find(function (gr) { return gr.banco === bancoSelecionado; });
  if (!grupo) return;

  document.getElementById("lista-titulo").textContent = grupo.banco;
  document.getElementById("lista-legenda").textContent =
    (grupo.banco === "Boleto" ? textoCompras(grupo.compras.length, true) : textoCompras(grupo.compras.length) + " parceladas") + " · " + formatarMoeda(grupo.restante) + " para pagar";

  listaParcelas.innerHTML = grupo.compras.map(function (c) {
    if (c.recorrente) return itemBoletoMensal(c);
    const porcentagem = Math.round((c.pagas / c.total) * 100);
    const faltam = c.total - c.pagas;
    return `
      <li class="item-parcela${classeItemBoleto(c)}">
        <div class="item-inicial">${escapar(c.g.plataforma.trim().charAt(0).toUpperCase())}</div>
        <div class="item-info">
          ${rotuloBoleto("Beneficiário")}<strong>${escapar(c.g.plataforma)}</strong>${autorHtml(c.g)}
          <small style="display:flex;flex-wrap:wrap;gap:0 8px"><span style="white-space:nowrap">${c.total === 1 ? "Boleto" : "Parcela " + c.proxima.numero + "/" + c.total}</span><span style="white-space:nowrap">vence ${formatarData(c.proxima.data)}</span></small>
          <div class="item-barra"><i style="width:${porcentagem}%"></i></div>
        </div>
        <div class="item-valores">
          ${rotuloBoleto("Valor")}
          <strong>${formatarMoeda(c.proxima.valor)}</strong>
          <small>${c.total === 1 ? "Pagamento único" : faltam === 1 ? "Última parcela" : "Faltam " + formatarMoeda(c.restante)}</small>
        </div>
        <button type="button" class="item-pagar" data-id="${c.g.id}" aria-label="Registrar pagamento de ${escapar(c.g.plataforma)}" title="Registrar pagamento">${ICONE_PAGO}</button>
      </li>`;
  }).join("");
}

// Marca o banco escolhido (cartão em destaque, bolinha e lista de baixo)
function selecionar(banco) {
  bancoSelecionado = banco;

  faixa.querySelectorAll(".cartao-banco").forEach(function (el) {
    el.classList.toggle("selecionado", el.dataset.banco === banco);
  });
  pontos.querySelectorAll("span").forEach(function (el, i) {
    el.classList.toggle("ativo", grupos[i].banco === banco);
  });

  // As setas (no computador) só aparecem se houver para onde ir
  const indice = grupos.findIndex(function (gr) { return gr.banco === banco; });
  const setaAnteriorCartao = document.getElementById("cartao-anterior");
  const setaProximaCartao = document.getElementById("cartao-proximo");
  if (setaAnteriorCartao) setaAnteriorCartao.hidden = grupos.length <= 1 || indice <= 0;
  if (setaProximaCartao) setaProximaCartao.hidden = grupos.length <= 1 || indice >= grupos.length - 1;

  mostrarLista();
}

// Ao arrastar, o cartão que parar no centro vira o escolhido
let esperandoQuadro = false;
faixa.addEventListener("scroll", function () {
  if (esperandoQuadro) return;
  esperandoQuadro = true;

  requestAnimationFrame(function () {
    esperandoQuadro = false;

    const centro = faixa.scrollLeft + faixa.clientWidth / 2;
    let maisPerto = null;
    let menorDistancia = Infinity;

    faixa.querySelectorAll(".cartao-banco").forEach(function (el) {
      const distancia = Math.abs(el.offsetLeft + el.offsetWidth / 2 - centro);
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        maisPerto = el;
      }
    });

    if (maisPerto && maisPerto.dataset.banco !== bancoSelecionado) selecionar(maisPerto.dataset.banco);
  });
});

// No celular o dedo já arrasta; no computador a pessoa usa as setas ao lado do cartão
function irParaCartao(banco) {
  const cartao = Array.from(faixa.querySelectorAll(".cartao-banco")).find(function (el) { return el.dataset.banco === banco; });
  if (!cartao) return;
  selecionar(banco);
  cartao.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
}

function moverCartao(passo) {
  const indice = grupos.findIndex(function (gr) { return gr.banco === bancoSelecionado; });
  const alvo = grupos[indice + passo];
  if (alvo) irParaCartao(alvo.banco);
}

document.addEventListener("click", function (e) {
  if (e.target.closest("#cartao-anterior")) moverCartao(-1);
  else if (e.target.closest("#cartao-proximo")) moverCartao(1);
});
// Clicar em um cartão leva ele para o centro
faixa.addEventListener("click", function (e) {
  const estrela = e.target.closest(".cartao-favorito");
  if (estrela) {
    alternarFavorito(estrela.closest(".cartao-banco").dataset.banco);
    return;
  }

  const cartao = e.target.closest(".cartao-banco");
  if (!cartao) return;

  selecionar(cartao.dataset.banco);
  cartao.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
});

function desenhar() {
  montarGrupos();

  if (grupos.length === 0) {
    estruturaPerdida = true;
    textoResumo.textContent = "Suas compras parceladas e boletos";
    areaParcelas.innerHTML = `
      <div class="vazio-card">
        <div class="vazio-icone">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/></svg>
        </div>
        <h3>Nenhuma parcela por aqui</h3>
        <p>Quando você registrar uma compra parcelada, acompanhe aqui quanto falta pagar e quando vence cada parcela.</p>
        <a class="vazio-botao" href="adicionar.html">+ Adicionar compra parcelada</a>
        <ul class="vazio-dicas">
          <li><strong>1</strong><span>Adicione um gasto e escolha <b>2x ou mais</b> em Parcelas</span></li>
          <li><strong>2</strong><span>Informe o valor <b>total</b> da compra e o dia de vencimento</span></li>
          <li><strong>3</strong><span>O Dashvia divide e mostra cada parcela, mês a mês</span></li>
        </ul>
      </div>`;
    return;
  }

  atualizarResumo();
  desenharCartoes();
  selecionar(grupos[0].banco);
  faixa.scrollLeft = 0;
}

function atualizarResumo() {
  const total = grupos.reduce(function (soma, gr) { return soma + gr.restante; }, 0);
  const quantidade = grupos.reduce(function (soma, gr) { return soma + gr.compras.length; }, 0);
  textoResumo.textContent = formatarMoeda(total) + " para pagar em " + quantidade + (quantidade === 1 ? " item" : " itens");
}

// Depois de marcar um pagamento: refaz cartões e lista, mantendo o banco que a pessoa estava vendo
function recarregarMantendoBanco() {
  // Se a tela já virou "nenhuma parcela" (tudo pago), a estrutura some; recarregar a página refaz tudo
  if (estruturaPerdida) {
    window.location.reload();
    return;
  }

  const escolhido = bancoSelecionado;
  montarGrupos();

  if (grupos.length === 0) {
    desenhar();
    return;
  }

  atualizarResumo();
  desenharCartoes();

  const alvo = grupos.some(function (gr) { return gr.banco === escolhido; }) ? escolhido : grupos[0].banco;
  selecionar(alvo);

  const cartao = Array.from(faixa.querySelectorAll(".cartao-banco")).find(function (el) { return el.dataset.banco === alvo; });
  if (cartao) faixa.scrollLeft = cartao.offsetLeft - (faixa.clientWidth - cartao.offsetWidth) / 2;
}

// ----- Registrar pagamento (próxima parcela, parcelas adiantadas ou quitação) -----
// "pagasAte" guarda o número da última parcela paga; as anteriores a ela contam como pagas.
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

// Boleto mensal: marca (ou desmarca) a cobrança do mês como paga. O boleto continua na lista, só muda o status.
async function alternarBoletoMensal(compra) {
  const g = compra.g;
  const o = compra.ocorrencia;
  const mes = o.data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const antes = g.pagasAte || 0;
  const depois = o.paga ? o.numero - 1 : o.numero;

  const pergunta = o.paga
    ? "Desfazer o pagamento do boleto " + g.plataforma + " de " + mes + "?"
    : "Marcar o boleto " + g.plataforma + " de " + mes + " como pago?";
  if (!(await confirmar(pergunta, o.paga ? "Desfazer" : "Marcar como pago"))) return;

  try {
    await atualizarGasto(g.id, { pagasAte: depois });
  } catch (falha) {
    console.error("Erro ao registrar pagamento do boleto:", falha);
    mostrarAviso("Não foi possível salvar. Tente de novo.");
    return;
  }

  g.pagasAte = depois;
  recarregarMantendoBanco();

  if (o.paga) {
    mostrarAviso("Pagamento desfeito.");
    return;
  }

  mostrarAviso("Boleto " + g.plataforma + " marcado como pago.", async function () {
    try {
      await atualizarGasto(g.id, { pagasAte: antes });
    } catch (falha) {
      console.error("Erro ao desfazer:", falha);
      mostrarAviso("Não foi possível desfazer. Tente de novo.");
      return;
    }
    g.pagasAte = antes;
    recarregarMantendoBanco();
  });
}

// Encerrar: o boleto deixa de cobrar a partir do mês que vem (este mês e os anteriores ficam como estão)
async function encerrarBoletoMensal(compra) {
  const g = compra.g;
  const hojeDia = new Date();
  const proximoMes = new Date(hojeDia.getFullYear(), hojeDia.getMonth() + 1, 1);
  const texto = proximoMes.getFullYear() + "-" + String(proximoMes.getMonth() + 1).padStart(2, "0") + "-01";
  const nomeMes = proximoMes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  if (!(await confirmar("Encerrar o boleto " + g.plataforma + "? Ele deixa de cobrar a partir de " + nomeMes + ". Os meses anteriores continuam no histórico.", "Encerrar"))) return;

  try {
    await atualizarGasto(g.id, { canceladoEm: texto });
  } catch (falha) {
    console.error("Erro ao encerrar o boleto:", falha);
    mostrarAviso("Não foi possível encerrar. Tente de novo.");
    return;
  }

  g.canceladoEm = texto;
  recarregarMantendoBanco();

  mostrarAviso("Boleto " + g.plataforma + " encerrado.", async function () {
    try {
      await atualizarGasto(g.id, { canceladoEm: null });
    } catch (falha) {
      console.error("Erro ao desfazer:", falha);
      mostrarAviso("Não foi possível desfazer. Tente de novo.");
      return;
    }
    g.canceladoEm = null;
    recarregarMantendoBanco();
  });
}

// Editar o nome, o valor e o dia do vencimento (vale para todos os meses)
function abrirEdicaoBoleto(compra) {
  const g = compra.g;
  const diaAtual = compra.ocorrencia.data.getDate();

  let opcoesDia = "";
  for (let d = 1; d <= 31; d++) {
    opcoesDia += '<option value="' + d + '"' + (d === diaAtual ? " selected" : "") + ">Dia " + d + "</option>";
  }

  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML = `
    <div class="modal modal-form">
      <h3 class="modal-titulo">Editar boleto</h3>
      <form id="form-boleto" class="formulario" novalidate>
        <label for="eb-nome">Nome do boleto</label>
        <input type="text" id="eb-nome" maxlength="60" autocomplete="off">

        <label for="eb-valor">Valor (R$)</label>
        <input type="number" id="eb-valor" step="0.01" min="0.01">

        <label for="eb-dia">Dia do vencimento (todo mês)</label>
        <select id="eb-dia">${opcoesDia}</select>

        <p class="modal-nota">A mudança vale para todos os meses.</p>
        <p class="modal-erro" id="eb-erro"></p>
      </form>
      <div class="modal-botoes">
        <button type="button" class="modal-cancelar">Cancelar</button>
        <button type="submit" form="form-boleto" class="modal-ok salvar">Salvar</button>
      </div>
    </div>`;

  const campoNome = fundo.querySelector("#eb-nome");
  const campoValor = fundo.querySelector("#eb-valor");
  const campoDia = fundo.querySelector("#eb-dia");
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

    botaoSalvar.disabled = true;
    const novo = { plataforma: nome, valor: valor, vencimento: Number(campoDia.value) };

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
    recarregarMantendoBanco();
    mostrarAviso("Boleto atualizado.");
  });

  document.body.appendChild(fundo);
  campoNome.focus();
}

function abrirPagamento(compra) {
  const g = compra.g;
  const faltam = compra.faltam;
  const total = compra.total;
  const proxima = faltam[0];

  function soma(quantidade) {
    return faltam.slice(0, quantidade).reduce(function (s, p) { return s + p.valor; }, 0);
  }

  const podeAntecipar = faltam.length >= 3;
  const podeQuitar = faltam.length >= 2;
  const podeDeTras = faltam.length >= 2; // pagar as últimas parcelas primeiro

  let opcoesQuantidade = "";
  for (let n = 2; n <= faltam.length - 1; n++) {
    opcoesQuantidade += '<option value="' + n + '">' + n + " parcelas</option>";
  }

  // De trás pra frente: pode pagar de 1 até todas menos a próxima (para pagar tudo existe "Quitei")
  let opcoesDeTras = "";
  for (let n = 1; n <= faltam.length - 1; n++) {
    opcoesDeTras += '<option value="' + n + '">' + (n === 1 ? "1 parcela" : n + " parcelas") + "</option>";
  }

  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML = `
    <div class="modal modal-form">
      <h3 class="modal-titulo">Registrar pagamento</h3>
      <p class="modal-nota">${escapar(g.plataforma)} · ${total === 1 ? "boleto único" : total + " parcelas"}</p>

      <div class="opcoes-pagamento">
        <label class="opcao-pagamento">
          <input type="radio" name="tipo" value="proxima" checked>
          <span>
            <strong>${total === 1 ? "Paguei o boleto" : faltam.length === 1 ? "Paguei a última parcela" : "Paguei a próxima parcela"}</strong>
            <small>${total === 1 ? "Vence " + formatarData(proxima.data) : "Parcela " + proxima.numero + "/" + total} · ${formatarMoeda(proxima.valor)}</small>
          </span>
        </label>

        ${podeAntecipar ? `
        <label class="opcao-pagamento">
          <input type="radio" name="tipo" value="antecipar">
          <span>
            <strong>Antecipei parcelas</strong>
            <small id="pg-detalhe-antecipar">Escolha quantas você pagou</small>
            <select id="pg-quantidade" class="oculto">${opcoesQuantidade}</select>
          </span>
        </label>` : ""}

        ${podeDeTras ? `
        <label class="opcao-pagamento">
          <input type="radio" name="tipo" value="detras">
          <span>
            <strong>Paguei de trás pra frente</strong>
            <small id="pg-detalhe-detras">As últimas parcelas, começando pela final</small>
            <select id="pg-quantidade-detras" class="oculto">${opcoesDeTras}</select>
          </span>
        </label>` : ""}

        ${podeQuitar ? `
        <label class="opcao-pagamento">
          <input type="radio" name="tipo" value="quitar">
          <span>
            <strong>Quitei todas as parcelas</strong>
            <small>As ${faltam.length} restantes · ${formatarMoeda(soma(faltam.length))}</small>
          </span>
        </label>` : ""}
      </div>

      <p class="modal-erro" id="pg-erro"></p>
      <div class="modal-botoes">
        <button type="button" class="modal-cancelar">Cancelar</button>
        <button type="button" class="modal-ok salvar">Confirmar</button>
      </div>
    </div>`;

  const erro = fundo.querySelector("#pg-erro");
  const seletor = fundo.querySelector("#pg-quantidade");
  const detalhe = fundo.querySelector("#pg-detalhe-antecipar");
  const seletorDeTras = fundo.querySelector("#pg-quantidade-detras");
  const detalheDeTras = fundo.querySelector("#pg-detalhe-detras");
  const botaoOk = fundo.querySelector(".modal-ok");

  function tipoEscolhido() {
    return fundo.querySelector('input[name="tipo"]:checked').value;
  }

  function atualizarAntecipar() {
    if (!seletor) return;
    const ativo = tipoEscolhido() === "antecipar";
    seletor.classList.toggle("oculto", !ativo);
    if (ativo) {
      const n = Number(seletor.value);
      detalhe.textContent = "Parcelas " + faltam[0].numero + " a " + faltam[n - 1].numero + " · " + formatarMoeda(soma(n));
    } else {
      detalhe.textContent = "Escolha quantas você pagou";
    }
  }

  // As últimas n parcelas que ainda faltam (n = 1 é a final)
  function atualizarDeTras() {
    if (!seletorDeTras) return;
    const ativo = tipoEscolhido() === "detras";
    seletorDeTras.classList.toggle("oculto", !ativo);
    if (ativo) {
      const n = Number(seletorDeTras.value);
      const ultimas = faltam.slice(faltam.length - n);
      const faixa = n === 1 ? "Parcela " + ultimas[0].numero : "Parcelas " + ultimas[0].numero + " a " + ultimas[n - 1].numero;
      const valor = ultimas.reduce(function (s, p) { return s + p.valor; }, 0);
      detalheDeTras.textContent = faixa + " · " + formatarMoeda(valor);
    } else {
      detalheDeTras.textContent = "As últimas parcelas, começando pela final";
    }
  }

  fundo.querySelectorAll('input[name="tipo"]').forEach(function (r) {
    r.addEventListener("change", function () {
      erro.textContent = "";
      atualizarAntecipar();
      atualizarDeTras();
    });
  });
  if (seletor) seletor.addEventListener("change", atualizarAntecipar);
  if (seletorDeTras) seletorDeTras.addEventListener("change", atualizarDeTras);

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

  botaoOk.addEventListener("click", async function () {
    const tipo = tipoEscolhido();
    const quantidade = tipo === "proxima" ? 1 : tipo === "quitar" ? faltam.length : tipo === "detras" ? Number(seletorDeTras.value) : Number(seletor.value);
    const antes = { pagasAte: g.pagasAte || 0, pagasFim: g.pagasFim || 0 };

    // Do começo: avança "pagasAte". De trás pra frente: avança "pagasFim" (quantas parcelas do fim já foram pagas)
    const depois = tipo === "detras"
      ? { pagasFim: total - faltam[faltam.length - quantidade].numero + 1 }
      : { pagasAte: faltam[quantidade - 1].numero };

    botaoOk.disabled = true;
    try {
      await atualizarGasto(g.id, depois);
    } catch (falha) {
      console.error("Erro ao registrar pagamento:", falha);
      erro.textContent = "Não foi possível salvar. Tente de novo.";
      botaoOk.disabled = false;
      return;
    }

    Object.assign(g, depois);
    fechar();
    recarregarMantendoBanco();

    const texto = tipo === "quitar"
      ? g.plataforma + " quitada."
      : tipo === "detras"
        ? (quantidade === 1 ? "Última parcela" : "As " + quantidade + " últimas parcelas") + " de " + g.plataforma + " marcada" + (quantidade === 1 ? "" : "s") + " como paga" + (quantidade === 1 ? "." : "s.")
      : quantidade === 1
        ? "Parcela " + proxima.numero + " de " + g.plataforma + " marcada como paga."
        : quantidade + " parcelas de " + g.plataforma + " marcadas como pagas.";

    mostrarAviso(texto, async function () {
      try {
        await atualizarGasto(g.id, antes);
      } catch (falha) {
        console.error("Erro ao desfazer:", falha);
        mostrarAviso("Não foi possível desfazer. Tente de novo.");
        return;
      }
      Object.assign(g, antes);
      recarregarMantendoBanco();
    });
  });

  document.body.appendChild(fundo);
  botaoOk.focus();
}

listaParcelas.addEventListener("click", function (e) {
  // Editar ou encerrar um boleto mensal
  const linkBoleto = e.target.closest(".link-boleto");
  if (linkBoleto) {
    const grupoBoleto = grupos.find(function (gr) { return gr.banco === bancoSelecionado; });
    const alvo = grupoBoleto && grupoBoleto.compras.find(function (c) { return c.g.id === Number(linkBoleto.dataset.id); });
    if (!alvo) return;
    if (linkBoleto.dataset.acao === "editar") abrirEdicaoBoleto(alvo);
    else encerrarBoletoMensal(alvo);
    return;
  }

  const botao = e.target.closest(".item-pagar");
  if (!botao) return;

  const grupo = grupos.find(function (gr) { return gr.banco === bancoSelecionado; });
  const compra = grupo && grupo.compras.find(function (c) { return c.g.id === Number(botao.dataset.id); });
  if (!compra) return;
  if (compra.recorrente) alternarBoletoMensal(compra);
  else abrirPagamento(compra);
});

// Confere o login e busca os gastos no banco
async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  // Gastos e perfil são buscados ao mesmo tempo
  const pedidoPerfil = buscarPerfil().catch(function (falha) {
    console.error(falha);
    return null;
  });

  try {
    gastos = await buscarGastos();
  } catch (falha) {
    console.error(falha);
    areaParcelas.innerHTML = '<p class="vazio">Não foi possível carregar suas parcelas. Atualize a página.</p>';
    return;
  }

  const perfil = await pedidoPerfil;
  bancoFavorito = (perfil && perfil.bancoFavorito) || null;

  desenhar();
  await montarEspaco();
}

// ---------- Lado "espaço compartilhado": lista de tudo que o grupo adicionou ----------
// No lado Casa esta página vira três abas: Tudo (lista com a foto de quem lançou), Parcelas (a tela de sempre) e Histórico.
let espacoDaTela = null;
let pessoasDoEspaco = {};
let abaEspaco = "tudo";

function novoEl(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function dataBr(texto) {
  const partes = String(texto).split("-");
  return partes.length === 3 ? partes[2] + "/" + partes[1] + "/" + partes[0] : String(texto);
}

// Foto (ou inicial) de quem lançou o gasto
function avatarDaPessoa(id, nomeAlternativo) {
  const pessoa = pessoasDoEspaco[id] || {};
  const nome = pessoa.nome || nomeAlternativo || "?";
  const a = novoEl("div", "esp-avatar feed-avatar", nome.trim().charAt(0).toUpperCase() || "?");
  if (pessoa.foto) {
    a.textContent = "";
    a.style.backgroundImage = 'url("' + String(pessoa.foto).replace(/"/g, "%22") + '")';
  }
  a.title = nome;
  return a;
}

function descricaoDoGasto(g) {
  if (g.categoria === "Boleto") {
    return g.parcelas === "mensal" ? "Boleto · todo mês" : g.parcelas === "1" ? "Boleto único" : "Boleto · " + g.parcelas + " parcelas";
  }
  if (g.categoria === "Assinatura") {
    return "Assinatura · " + ({ mensal: "mensal", trimestral: "trimestral", anual: "anual" }[g.parcelas] || "");
  }
  const base = g.categoria + " · " + (g.parcelas === "pix" ? "Pix" : (g.banco || "Cartão"));
  return /^\d+$/.test(g.parcelas) && Number(g.parcelas) >= 2 ? base + " · " + g.parcelas + "x" : base;
}

function linhaDoFeed(g) {
  const li = novoEl("li", "feed-item");
  li.append(avatarDaPessoa(g.autorId, g.autorNome));

  const corpo = novoEl("div", "feed-corpo");
  const quem = primeiroNome(g.autorNome || (pessoasDoEspaco[g.autorId] || {}).nome) || "Alguém";
  corpo.append(
    novoEl("strong", "", g.plataforma),
    novoEl("small", "", descricaoDoGasto(g)),
    novoEl("small", "feed-autor", "por " + quem + (g.criadoEm ? " · " + tempoDecorrido(g.criadoEm) : ""))
  );
  li.append(corpo);

  const direita = novoEl("div", "feed-direita");
  direita.append(novoEl("strong", "", formatarMoeda(g.valor)), novoEl("small", "", dataBr(g.data)));
  li.append(direita);

  const remover = novoEl("button", "feed-remover", "✕");
  remover.type = "button";
  remover.title = "Remover gasto";
  remover.setAttribute("aria-label", "Remover " + g.plataforma);
  remover.addEventListener("click", async function () {
    if (!await confirmar("Remover " + g.plataforma + " do espaço? Isso fica registrado no histórico.", "Remover")) return;
    try {
      await removerGasto(g.id);
    } catch (falha) {
      console.error(falha);
      alert("Não foi possível remover. Tente de novo.");
      return;
    }
    gastos = gastos.filter(function (x) { return x.id !== g.id; });
    desenhar();
    renderizarEspaco();
  });
  li.append(remover);
  return li;
}

// Mês que o cartão de total está mostrando (começa no atual)
let mesDoTotal = null;

function mesAtualDoTotal() {
  if (!mesDoTotal) {
    const agora = new Date();
    mesDoTotal = { ano: agora.getFullYear(), mes: agora.getMonth() };
  }
  return mesDoTotal;
}

// Quanto o espaço gasta no mês escolhido (mesma conta do Dashboard), com a divisão por tipo.
// As setas voltam até o primeiro gasto do espaço e avançam até 12 meses à frente.
function cartaoTotalDoMes() {
  const escolhido = mesAtualDoTotal();
  const indice = escolhido.ano * 12 + escolhido.mes;
  const agora = new Date();
  const atual = agora.getFullYear() * 12 + agora.getMonth();

  let primeiro = atual;
  gastos.forEach(function (g) {
    const partes = String(g.data).split("-").map(Number);
    if (partes.length === 3) primeiro = Math.min(primeiro, partes[0] * 12 + (partes[1] - 1));
  });

  const total = { geral: 0, categorias: {} };
  gastos.forEach(function (g) {
    const valor = valorNoMes(g, escolhido.ano, escolhido.mes);
    if (valor <= 0) return;
    total.geral += valor;
    total.categorias[g.categoria] = (total.categorias[g.categoria] || 0) + valor;
  });

  function irPara(novoIndice) {
    mesDoTotal = { ano: Math.floor(novoIndice / 12), mes: novoIndice % 12 };
    renderizarEspaco();
  }

  function seta(direcao, desativada) {
    const b = novoEl("button", "feed-total-seta");
    b.type = "button";
    b.disabled = desativada;
    b.setAttribute("aria-label", direcao < 0 ? "Mês anterior" : "Próximo mês");
    b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="' + (direcao < 0 ? "15 18 9 12 15 6" : "9 18 15 12 9 6") + '"/></svg>';
    b.addEventListener("click", function () { irPara(indice + direcao); });
    return b;
  }

  const nomeDoMes = new Date(escolhido.ano, escolhido.mes, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const cartao = novoEl("div", "bloco feed-total");

  const topo = novoEl("div", "feed-total-topo");
  topo.append(
    seta(-1, indice <= primeiro),
    novoEl("span", "feed-total-rotulo", "Gastos de " + nomeDoMes + (indice === atual ? " (mês atual)" : "")),
    seta(1, indice >= atual + 12)
  );
  cartao.append(topo);
  cartao.append(novoEl("strong", "feed-total-valor", formatarMoeda(total.geral)));

  const tipos = Object.keys(total.categorias).sort(function (a, b) { return total.categorias[b] - total.categorias[a]; });
  if (tipos.length > 0) {
    const fichas = novoEl("div", "feed-total-tipos");
    tipos.forEach(function (nome) {
      const ficha = novoEl("span", "feed-total-tipo");
      ficha.append(novoEl("small", "", nome), novoEl("b", "", formatarMoeda(total.categorias[nome])));
      fichas.append(ficha);
    });
    cartao.append(fichas);
  } else {
    cartao.append(novoEl("small", "feed-total-vazio", "Nenhum gasto neste mês."));
  }
  return cartao;
}
function renderizarEspaco() {
  if (!espacoDaTela) return;

  const titulo = document.querySelector(".conteudo header h1");
  titulo.textContent = "Gastos " + espacoDaTela.nome;
  titulo.classList.add("titulo-uma-linha");
  textoResumo.textContent = gastos.length + (gastos.length === 1 ? " gasto" : " gastos") + " no espaço compartilhado";

  const feed = document.getElementById("feed-espaco");
  feed.textContent = "";

  if (gastos.length > 0) feed.append(cartaoTotalDoMes());

  if (gastos.length === 0) {
    const vazio = novoEl("div", "bloco esp-vazio");
    vazio.append(novoEl("p", "", "Nada foi adicionado ainda. Em Adicionar gasto, com o seletor em " + espacoDaTela.nome + ", o que você lançar aparece aqui para todo mundo."));
    feed.append(vazio);
  } else {
    const lista = novoEl("ul", "bloco feed-lista");
    gastos.slice().sort(function (a, b) { return b.id - a.id; }).forEach(function (g) {
      lista.append(linhaDoFeed(g));
    });
    feed.append(lista);
  }

  renderizarAssinaturasDoEspaco();
}

// ----- Aba Assinaturas do espaço -----
const PASSOS_ASSINATURA = { mensal: 1, trimestral: 3, anual: 12 };
const NOMES_PERIODO = { mensal: "Mensal", trimestral: "Trimestral", anual: "Anual" };

// Próxima cobrança: a primeira data depois de hoje (mesma regra da página de Assinaturas)
function proximaCobrancaAssinatura(g) {
  const passo = PASSOS_ASSINATURA[g.parcelas];
  if (!passo) return null;

  const [ano, mes, dia] = g.data.split("-").map(Number);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const primeira = new Date(ano, mes - 1, dia);
  if (primeira > hoje) return primeira;

  let k = 1;
  let data = somarMeses(ano, mes - 1, dia, passo);
  while (data <= hoje && k < 5000) {
    k++;
    data = somarMeses(ano, mes - 1, dia, passo * k);
  }
  return data;
}

function prazoDaCobranca(data) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((data - hoje) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "amanhã";
  return "em " + dias + " dias";
}

function renderizarAssinaturasDoEspaco() {
  const caixa = document.getElementById("assinaturas-espaco");
  if (!caixa) return;
  caixa.textContent = "";

  const itens = gastos
    .filter(function (g) { return g.categoria === "Assinatura" && !g.canceladoEm; })
    .map(function (g) { return { g: g, proxima: proximaCobrancaAssinatura(g) }; })
    .sort(function (a, b) {
      if (!a.proxima) return 1;
      if (!b.proxima) return -1;
      return a.proxima - b.proxima;
    });

  if (itens.length === 0) {
    const vazio = novoEl("div", "bloco esp-vazio");
    vazio.append(novoEl("p", "", "Nenhuma assinatura no espaço ainda. Em Adicionar gasto, com o seletor em " + espacoDaTela.nome + ", escolha a categoria Assinatura."));
    caixa.append(vazio);
    return;
  }

  let porMes = 0;
  itens.forEach(function (item) {
    const passo = PASSOS_ASSINATURA[item.g.parcelas];
    if (passo) porMes += item.g.valor / passo;
  });

  const resumoCartao = novoEl("div", "bloco feed-total");
  resumoCartao.append(novoEl("span", "feed-total-rotulo", "Assinaturas do espaço"));
  resumoCartao.append(novoEl("strong", "feed-total-valor", formatarMoeda(porMes) + " /mês"));
  const fichas = novoEl("div", "feed-total-tipos");
  [["Em 12 meses", formatarMoeda(porMes * 12)], ["Assinaturas", String(itens.length)]].forEach(function (par) {
    const ficha = novoEl("span", "feed-total-tipo");
    ficha.append(novoEl("small", "", par[0]), novoEl("b", "", par[1]));
    fichas.append(ficha);
  });
  resumoCartao.append(fichas);
  caixa.append(resumoCartao);

  const lista = novoEl("ul", "bloco feed-lista");
  itens.forEach(function (item) {
    const g = item.g;
    const li = novoEl("li", "feed-item");
    li.append(avatarDaPessoa(g.autorId, g.autorNome));

    const corpo = novoEl("div", "feed-corpo");
    const quem = primeiroNome(g.autorNome || (pessoasDoEspaco[g.autorId] || {}).nome) || "Alguém";
    corpo.append(
      novoEl("strong", "", g.plataforma),
      novoEl("small", "", (NOMES_PERIODO[g.parcelas] || "Assinatura") + " · " + (g.banco || "Cartão")),
      novoEl("small", "feed-autor", "por " + quem + (item.proxima ? " · próxima cobrança " + prazoDaCobranca(item.proxima) : ""))
    );
    li.append(corpo);

    const direita = novoEl("div", "feed-direita");
    direita.append(novoEl("strong", "", formatarMoeda(g.valor)));
    if (item.proxima) direita.append(novoEl("small", "", item.proxima.toLocaleDateString("pt-BR")));
    li.append(direita);
    lista.append(li);
  });
  caixa.append(lista);

  const gerenciar = novoEl("a", "atalho-espaco", "Editar ou cancelar assinaturas");
  gerenciar.href = "assinaturas.html";
  caixa.append(gerenciar);
}

function mostrarAbaEspaco(aba) {
  abaEspaco = aba;
  document.querySelectorAll("#abas-espaco .esp-aba").forEach(function (b) {
    const ativa = b.dataset.aba === aba;
    b.classList.toggle("ativa", ativa);
    b.setAttribute("aria-selected", String(ativa));
  });

  document.getElementById("feed-espaco").style.display = aba === "tudo" ? "" : "none";
  document.getElementById("assinaturas-espaco").style.display = aba === "assinaturas" ? "" : "none";
  areaParcelas.style.display = aba === "parcelas" ? "" : "none";

  if (aba === "parcelas") desenhar();
  else renderizarEspaco();
}

async function montarEspaco() {
  espacoDaTela = await escopoAtual();
  if (!espacoDaTela) return;

  try {
    (await listarMembros()).forEach(function (m) { pessoasDoEspaco[m.id] = m; });
  } catch (falha) {
    console.error(falha);
  }

  if (!document.getElementById("abas-espaco")) {
    // O histórico fica separado: um atalho para a tela do espaço, já na aba Histórico
    const historico = novoEl("a", "atalho-espaco atalho-historico", "Ver histórico do espaço");
    historico.href = "historico.html";

    const abas = novoEl("div", "esp-abas");
    abas.id = "abas-espaco";
    abas.setAttribute("role", "tablist");
    [["tudo", "Tudo"], ["parcelas", "Parcelas"], ["assinaturas", "Assinaturas"]].forEach(function (a) {
      const b = novoEl("button", "esp-aba", a[1]);
      b.type = "button";
      b.dataset.aba = a[0];
      b.setAttribute("role", "tab");
      b.addEventListener("click", function () { mostrarAbaEspaco(a[0]); });
      abas.append(b);
    });

    const feed = novoEl("div");
    feed.id = "feed-espaco";
    const assinaturas = novoEl("div");
    assinaturas.id = "assinaturas-espaco";
    areaParcelas.before(historico, abas, feed, assinaturas);
  }

  mostrarAbaEspaco(abaEspaco);
}
iniciar();

// Ao voltar para a aba depois de um tempo, busca os gastos de novo
recarregarAoVoltar(async function () {
  gastos = await buscarGastos();
  desenhar();
  if (espacoDaTela) {
    try {
      (await listarMembros()).forEach(function (m) { pessoasDoEspaco[m.id] = m; });
    } catch (falha) {
      console.error(falha);
    }
    mostrarAbaEspaco(abaEspaco);
  }
});
