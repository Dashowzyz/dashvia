// Todos os gastos: a lista completa, do mais recente para o mais antigo, separada por mês.
// É aqui que a pessoa corrige (lápis) ou apaga (✕) um gasto. Boletos e assinaturas se editam nas próprias páginas.
let gastos = [];

const listaGastos = document.getElementById("lista-gastos");
const campoBusca = document.getElementById("busca-gastos");
const textoResumo = document.getElementById("resumo-gastos");

function formatarMoeda(numero) {
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(texto) {
  const [ano, mes, dia] = texto.split("-");
  return dia + "/" + mes + "/" + ano;
}

function escapar(texto) {
  return String(texto == null ? "" : texto).replace(/[&<>"']/g, function (c) {
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

const ICONE_ASSINATURA = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>';
const ICONE_PARCELAS = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 14v2.2l1.6 1"/><path d="M16 2v4"/><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M3 10h5"/><path d="M8 2v4"/><circle cx="16" cy="16" r="6"/></svg>';
const ICONE_LAPIS = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';

// Uma linha da lista (mesmo visual do antigo histórico do Dashboard)
function linhaDoGasto(g) {
  let editar;
  if (g.categoria === "Assinatura" && !g.espacoId) {
    editar = '<a class="editar" href="assinaturas.html" title="Editar em Assinaturas" aria-label="Editar ' + escapar(g.plataforma) + ' em Assinaturas">' + ICONE_ASSINATURA + "</a>";
  } else if (g.categoria === "Boleto") {
    editar = '<a class="editar" href="parcelas.html" title="Editar em Parcelas futuras" aria-label="Editar ' + escapar(g.plataforma) + ' em Parcelas futuras">' + ICONE_PARCELAS + "</a>";
  } else {
    editar = '<button type="button" class="editar" data-id="' + g.id + '" title="Editar gasto" aria-label="Editar ' + escapar(g.plataforma) + '">' + ICONE_LAPIS + "</button>";
  }

  return `
    <li>
      <span>${escapar(g.plataforma)}${autorHtml(g)}</span>
      <span>${escapar(g.categoria)}</span>
      <span>${formatarData(g.data)}</span>
      <span>${formatarMoeda(g.valor)}</span>
      <span class="tag">${g.categoria === "Boleto" && g.parcelas === "1" ? "Único" : textoParcelas(g.parcelas)}</span>
      <div class="acoes">
        ${editar}
        <button type="button" class="remover" data-id="${g.id}" title="Remover gasto" aria-label="Remover ${escapar(g.plataforma)}">✕</button>
      </div>
    </li>`;
}

function combinaComBusca(g, busca) {
  if (!busca) return true;
  return normalizarNome([g.plataforma, g.categoria, g.banco, textoParcelas(g.parcelas)].join(" ")).includes(busca);
}

function mostrarGastos() {
  if (gastos.length === 0) {
    textoResumo.textContent = "Nenhum gasto ainda";
    listaGastos.innerHTML = '<section class="bloco"><p class="vazio">Nenhum gasto adicionado ainda. Use <a href="adicionar.html">Adicionar gasto</a> para começar.</p></section>';
    return;
  }

  const busca = normalizarNome(campoBusca.value);
  const filtrados = gastos
    .filter(function (g) { return combinaComBusca(g, busca); })
    .sort(function (a, b) { return (b.data < a.data ? -1 : b.data > a.data ? 1 : 0) || (b.id - a.id); });

  textoResumo.textContent = busca
    ? filtrados.length + (filtrados.length === 1 ? " gasto encontrado" : " gastos encontrados")
    : gastos.length + (gastos.length === 1 ? " gasto registrado" : " gastos registrados");

  if (filtrados.length === 0) {
    listaGastos.innerHTML = '<section class="bloco"><p class="vazio">Nenhum gasto encontrado para essa busca.</p></section>';
    return;
  }

  // Um bloco por mês da compra
  const meses = [];
  filtrados.forEach(function (g) {
    const chave = g.data.slice(0, 7);
    let mes = meses[meses.length - 1];
    if (!mes || mes.chave !== chave) {
      mes = { chave: chave, itens: [] };
      meses.push(mes);
    }
    mes.itens.push(g);
  });

  listaGastos.innerHTML = meses.map(function (m) {
    const [ano, mes] = m.chave.split("-").map(Number);
    const nomeMes = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const nome = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
    return `
      <section class="bloco">
        <h2>${nome}</h2>
        <p class="legenda">${m.itens.length + (m.itens.length === 1 ? " gasto" : " gastos")}</p>
        <ul class="historico">${m.itens.map(linhaDoGasto).join("")}</ul>
      </section>`;
  }).join("");
}

campoBusca.addEventListener("input", mostrarGastos);

// Editar um gasto
listaGastos.addEventListener("click", async function (evento) {
  const botao = evento.target.closest("button.editar");
  if (!botao) return;

  const gasto = gastos.find(function (g) { return g.id === Number(botao.dataset.id); });
  if (!gasto) return;
  const opcoes = await categoriasParaEditar(gastos);
  abrirEdicao(gasto, Object.assign({ aoSalvar: mostrarGastos }, opcoes));
});

// Remover um gasto
listaGastos.addEventListener("click", async function (evento) {
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
  mostrarGastos();
});

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  try {
    gastos = await buscarGastos();
  } catch (falha) {
    console.error(falha);
    textoResumo.textContent = "Não foi possível carregar seus gastos. Atualize a página.";
    return;
  }
  mostrarGastos();
}

iniciar();

// Ao voltar para a aba depois de um tempo, busca os gastos de novo
recarregarAoVoltar(async function () {
  gastos = await buscarGastos();
  mostrarGastos();
});
