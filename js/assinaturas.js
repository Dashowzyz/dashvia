// As assinaturas são os gastos da categoria "Assinatura" (vêm do banco de dados)
let gastos = [];

// De quantos em quantos meses cada periodicidade se repete
const passos = { mensal: 1, trimestral: 3, anual: 12 };
const listaPeriodos = [["mensal", "Mensal"], ["trimestral", "Trimestral"], ["anual", "Anual"]];
const listaBancos = BANCOS.map(function (b) { return b.nome; }); // vem do bancos.js

// Banco digitado pela pessoa em "Outro" entra na lista da edição, para não ser trocado ao salvar
function bancosDaEdicao(atual) {
  if (!atual || listaBancos.includes(atual)) return listaBancos;
  return listaBancos.slice(0, -1).concat([atual, "Outro"]);
}

const listaAssinaturas = document.getElementById("lista-assinaturas");
const textoResumo = document.getElementById("resumo-assinaturas");

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

// Soma meses a uma data; se o dia não existir no mês (ex.: 31 em fevereiro), usa o último dia
function somarMeses(ano, mes, dia, quantidade) {
  const total = ano * 12 + mes + quantidade;
  const novoAno = Math.floor(total / 12);
  const novoMes = total % 12;
  const ultimoDia = new Date(novoAno, novoMes + 1, 0).getDate();
  return new Date(novoAno, novoMes, Math.min(dia, ultimoDia));
}

// Próxima cobrança: a primeira data depois de hoje
function proximaCobranca(g) {
  const passo = passos[g.parcelas];
  if (!passo) return null;

  const [ano, mes, dia] = g.data.split("-").map(Number);
  const diaCobranca = dia; // a cobrança cai no mesmo dia da data da assinatura
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const primeira = new Date(ano, mes - 1, dia);
  if (primeira > hoje) return primeira;

  let k = 1;
  let data = somarMeses(ano, mes - 1, diaCobranca, passo);
  while (data <= hoje && k < 5000) {
    k++;
    data = somarMeses(ano, mes - 1, diaCobranca, passo * k);
  }
  return data;
}

// Quanto vai gastar com ela em 12 meses
function gastoEm12Meses(g) {
  const passo = passos[g.parcelas];
  return passo ? g.valor * (12 / passo) : null;
}

// Cor fixa para cada assinatura, calculada a partir do nome
function corDoNome(nome) {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) % 360;
  return "hsl(" + h + ", 55%, 42%)";
}

// "hoje", "amanhã" ou "em N dias"
function textoPrazo(data) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((data - hoje) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "amanhã";
  return "em " + dias + " dias";
}

function desenhar() {
  const assinaturas = gastos
    .filter(function (g) { return g.categoria === "Assinatura"; })
    .map(function (g) { return { g: g, proxima: proximaCobranca(g) }; })
    .sort(function (a, b) {
      if (!a.proxima) return 1;
      if (!b.proxima) return -1;
      return a.proxima - b.proxima;
    });

  if (assinaturas.length === 0) {
    textoResumo.textContent = "Gerencie suas assinaturas";
    listaAssinaturas.innerHTML = `
      <div class="vazio-card">
        <div class="vazio-icone">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
        </div>
        <h3>Nenhuma assinatura por aqui</h3>
        <p>Quando você registrar uma assinatura, acompanhe aqui quanto ela custa, quando será a próxima cobrança e quanto você gasta em 12 meses.</p>
        <a class="vazio-botao" href="adicionar.html">+ Adicionar assinatura</a>
        <ul class="vazio-dicas">
          <li><strong>1</strong><span>Adicione um gasto e escolha a categoria <b>Assinatura</b></span></li>
          <li><strong>2</strong><span>Informe o valor e a <b>periodicidade</b>: mensal, trimestral ou anual</span></li>
          <li><strong>3</strong><span>O Dashvia calcula a próxima cobrança e o gasto do ano</span></li>
        </ul>
      </div>`;
    return;
  }

  const total = assinaturas.reduce(function (soma, item) {
    return soma + (gastoEm12Meses(item.g) || 0);
  }, 0);
  textoResumo.textContent =
    assinaturas.length + (assinaturas.length === 1 ? " assinatura" : " assinaturas") +
    " · " + formatarMoeda(total) + " em 12 meses";

  listaAssinaturas.innerHTML = assinaturas.map(function (item) {
    const g = item.g;
    const gasto12 = gastoEm12Meses(g);
    const nomePeriodo = (listaPeriodos.find(function (p) { return p[0] === g.parcelas; }) || [])[1];

    return `
      <article class="assinatura">
        <div class="assinatura-topo">
          <span class="assinatura-inicial" style="background:${corDoNome(g.plataforma)}" aria-hidden="true">${escapar(g.plataforma.trim().charAt(0).toUpperCase() || "?")}</span>
          <div class="assinatura-nome">
            <h3>${escapar(g.plataforma)}</h3>
            <span class="tag">${nomePeriodo || "Sem periodicidade"}</span>
          </div>
          <strong class="assinatura-valor">${formatarMoeda(g.valor)}</strong>
        </div>

        <div class="assinatura-proxima${item.proxima && textoPrazo(item.proxima) !== "" && Math.round((item.proxima - new Date().setHours(0, 0, 0, 0)) / 86400000) <= 7 ? " em-breve" : ""}">
          <span>Próxima cobrança</span>
          <strong>${item.proxima ? item.proxima.toLocaleDateString("pt-BR") : "—"}</strong>
          ${item.proxima ? '<em class="prazo">' + textoPrazo(item.proxima) + "</em>" : ""}
        </div>

        <ul class="detalhes">
          <li><span>Cartão</span><strong class="detalhe-cartao">${iconeBanco(g.banco || "Outro")}${escapar(g.banco || "Outro")}</strong></li>
          <li><span>Data da assinatura</span><strong>${formatarData(g.data)}</strong></li>
          <li><span>Gasto em 12 meses</span><strong>${gasto12 === null ? "—" : formatarMoeda(gasto12)}</strong></li>
        </ul>

        <div class="acoes acoes-assinatura">
          <button class="editar" data-id="${g.id}" title="Editar assinatura" aria-label="Editar assinatura"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
          <button class="remover" data-id="${g.id}" title="Remover assinatura" aria-label="Remover assinatura">✕</button>
        </div>
      </article>`;
  }).join("");
}

function montarOpcoes(lista, atual) {
  return lista.map(function (item) {
    const valor = Array.isArray(item) ? item[0] : item;
    const texto = Array.isArray(item) ? item[1] : item;
    const marcado = String(valor) === String(atual) ? " selected" : "";
    return '<option value="' + valor + '"' + marcado + ">" + texto + "</option>";
  }).join("");
}

// Janela para editar a assinatura
function abrirEdicao(g) {
  const periodoConhecido = !!passos[g.parcelas];

  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML = `
    <div class="modal modal-form">
      <h3 class="modal-titulo">Editar assinatura</h3>
      <form id="form-editar" class="formulario" novalidate>
        <label for="ed-nome">Nome da assinatura</label>
        <input type="text" id="ed-nome">

        <label for="ed-valor">Valor (R$)</label>
        <input type="number" id="ed-valor" step="0.01" min="0.01">

        <label for="ed-periodo">Periodicidade</label>
        <select id="ed-periodo">
          ${periodoConhecido ? "" : '<option value="" disabled selected>Escolha</option>'}
          ${montarOpcoes(listaPeriodos, g.parcelas)}
        </select>

        <label for="ed-data">Data da assinatura</label>
        <input type="date" id="ed-data">

        <label for="ed-banco">Banco</label>
        <select id="ed-banco">${montarOpcoes(bancosDaEdicao(g.banco), g.banco || "Outro")}</select>

        <p class="modal-erro" id="ed-erro"></p>
      </form>
      <div class="modal-botoes">
        <button type="button" class="modal-cancelar">Cancelar</button>
        <button type="submit" form="form-editar" class="modal-ok salvar">Salvar</button>
      </div>
    </div>`;

  const campoNome = fundo.querySelector("#ed-nome");
  const erro = fundo.querySelector("#ed-erro");

  campoNome.value = g.plataforma;
  fundo.querySelector("#ed-valor").value = g.valor;
  fundo.querySelector("#ed-data").value = g.data;

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

    const nome = campoNome.value.trim();
    const valor = parseFloat(fundo.querySelector("#ed-valor").value);
    const periodo = fundo.querySelector("#ed-periodo").value;
    const data = fundo.querySelector("#ed-data").value;

    if (!nome) { erro.textContent = "Preencha o nome da assinatura."; return; }
    if (!(valor > 0)) { erro.textContent = "Digite um valor maior que zero."; return; }
    if (!periodo) { erro.textContent = "Escolha a periodicidade."; return; }
    if (!data) { erro.textContent = "Escolha a data da assinatura."; return; }

    const campos = {
      plataforma: nome,
      valor: valor,
      parcelas: periodo,
      data: data,
      vencimento: null,
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
    desenhar();
  });

  document.body.appendChild(fundo);
  campoNome.focus();
}

listaAssinaturas.addEventListener("click", async function (evento) {
  const botaoEditar = evento.target.closest(".editar");
  const botaoRemover = evento.target.closest(".remover");

  if (botaoEditar) {
    const id = Number(botaoEditar.dataset.id);
    const gasto = gastos.find(function (g) { return g.id === id; });
    if (gasto) abrirEdicao(gasto);
    return;
  }

  if (botaoRemover) {
    const id = Number(botaoRemover.dataset.id);
    const confirmado = await confirmar("Remover esta assinatura? Ela deixa de contar em todos os meses.", "Remover");
    if (!confirmado) return;

    try {
      await removerGasto(id);
    } catch (falha) {
      console.error(falha);
      alert("Não foi possível remover. Tente de novo.");
      return;
    }

    gastos = gastos.filter(function (g) { return g.id !== id; });
    desenhar();
  }
});

// Confere o login e busca as assinaturas no banco
async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  try {
    gastos = await buscarGastos();
  } catch (falha) {
    console.error(falha);
    listaAssinaturas.innerHTML = '<p class="vazio">Não foi possível carregar suas assinaturas. Atualize a página.</p>';
    return;
  }

  desenhar();
}

iniciar();
