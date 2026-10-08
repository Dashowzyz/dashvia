// Janela de editar um gasto (usada no Dashboard e nos gastos do espaço compartilhado).
// Quem chama diz quais categorias valem e o que fazer depois de salvar:
//   abrirEdicao(gasto, { categorias: [...], personalizadas: [...], permitirNova: true, aoSalvar: function () { ... } })

// Quais categorias a janela oferece: no espaço, só as que ele aceita; no lado pessoal, as padrão + as criadas pela pessoa
async function categoriasParaEditar(todosOsGastos) {
  const espaco = await escopoAtual();
  if (espaco) {
    return { categorias: CATEGORIAS_ESPACO.filter(function (c) { return c !== "Boleto"; }), personalizadas: [], permitirNova: false };
  }
  const personalizadas = categoriasPersonalizadas(todosOsGastos.map(function (x) { return x.categoria; }));
  return {
    categorias: CATEGORIAS_PADRAO.filter(function (c) { return c !== "Boleto"; }).concat(personalizadas),
    personalizadas: personalizadas,
    permitirNova: true
  };
}
const listaBancos = BANCOS.map(function (b) { return b.nome; }); // vem do bancos.js

// Banco digitado pela pessoa em "Outro" entra na lista da edição, para não ser trocado ao salvar
function bancosDaEdicao(atual) {
  if (!atual || listaBancos.includes(atual)) return listaBancos;
  return listaBancos.slice(0, -1).concat([atual, "Outro"]);
}
const opcoesDeParcelas = [["pix", "Pix"], ["avista", "Sem parcelas"]].concat(
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
function abrirEdicao(g, opcoes) {
  // As categorias vêm de quem chama: no lado pessoal, as padrão + as criadas; no espaço, só as que o espaço aceita
  const personalizadas = opcoes.personalizadas || [];
  const categoriasDoGasto = opcoes.categorias;
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
        <select id="ed-categoria">${montarOpcoes(opcoes.permitirNova ? categoriasDoGasto.concat([[NOVA_CATEGORIA, "+ Nova categoria"]]) : categoriasDoGasto, g.categoria)}</select>

        <div id="ed-grupo-nova" class="oculto">
          <label for="ed-nova-categoria">Nome da nova categoria</label>
          <input type="text" id="ed-nova-categoria" maxlength="30" placeholder="Ex: Academia" autocomplete="off">
        </div>

        <label for="ed-parcelas" id="ed-rotulo-parcelas">${eAssinatura ? "Periodicidade" : "Parcelas"}</label>
        <select id="ed-parcelas">${montarOpcoes(eAssinatura ? listaPeriodos : opcoesDeParcelas, g.parcelas)}</select>

        <label for="ed-data">Data da compra</label>
        <input type="date" id="ed-data">

        <label for="ed-valor">Valor (R$)</label>
        <input type="number" id="ed-valor" step="0.01" min="0.01">

        <div id="ed-grupo-venc">
          <label for="ed-venc" id="ed-rotulo-venc">${eAssinatura ? "Dia da cobrança" : "Dia do vencimento da parcela"}</label>
          <select id="ed-venc">${montarOpcoes(listaDias, g.vencimento || 1)}</select>
        </div>

        <label for="ed-banco">Cartão ou banco</label>
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

    campoParcelas.innerHTML = montarOpcoes(assinatura ? listaPeriodos : opcoesDeParcelas, "");
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
    if (opcoes.aoSalvar) opcoes.aoSalvar();
  });

  document.body.appendChild(fundo);
  campoPlataforma.focus();
}
