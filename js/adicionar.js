// Só entra quem estiver logado
exigirLogin();

const form = document.getElementById("form-gasto");
const campoParcelas = document.getElementById("parcelas");
const grupoVencimento = document.getElementById("grupo-vencimento");
const campoVencimento = document.getElementById("vencimento");
const sucesso = document.getElementById("sucesso");

const campoCategoria = document.getElementById("categoria");
const grupoNovaCategoria = document.getElementById("grupo-nova-categoria");
const campoNovaCategoria = document.getElementById("nova-categoria");

// Categorias que a pessoa criou (vêm dos gastos dela)
let personalizadas = [];

// A opção "+ Nova categoria" fica sempre por último na lista
campoCategoria.add(new Option("+ Nova categoria", NOVA_CATEGORIA));

function adicionarOpcaoCategoria(nome) {
  const opcaoNova = campoCategoria.querySelector('option[value="' + NOVA_CATEGORIA + '"]');
  campoCategoria.add(new Option(nome, nome), opcaoNova);
}
const rotuloParcelas = document.querySelector('label[for="parcelas"]');

// Guarda as opções normais de parcelas para poder voltar a elas
const opcoesParcelas = campoParcelas.innerHTML;
const opcoesAssinatura =
  '<option value="" disabled selected>Escolha</option>' +
  '<option value="mensal">Mensal</option>' +
  '<option value="trimestral">Trimestral</option>' +
  '<option value="anual">Anual</option>';

// Preenche os dias de 1 a 31 no vencimento
for (let dia = 1; dia <= 31; dia++) {
  campoVencimento.add(new Option("Dia " + dia, dia));
}

const campoForma = document.getElementById("forma");
const grupoForma = document.getElementById("grupo-forma");
const grupoParcelas = document.getElementById("grupo-parcelas");

// Boleto: some quase tudo e aparecem o tipo (residencial ou compras) e, em compras, as parcelas
const grupoBoleto = document.getElementById("grupo-boleto");
const campoTipoBoleto = document.getElementById("tipo-boleto");
const grupoParcelasBoleto = document.getElementById("grupo-parcelas-boleto");
const campoParcelasBoleto = document.getElementById("parcelas-boleto");
const grupoBanco = document.getElementById("grupo-banco");
const rotuloPlataforma = document.getElementById("rotulo-plataforma");
const rotuloBanco = document.getElementById("rotulo-banco");
const rotuloOutroBanco = document.querySelector('label[for="outro-banco"]');
const campoPlataforma = document.getElementById("plataforma");
const rotuloData = document.getElementById("rotulo-data");
const rotuloValor = document.getElementById("rotulo-valor");

function ehBoleto() {
  return campoCategoria.value === "Boleto";
}

// Mercado: compra do dia a dia, quase nunca parcelada
function ehMercado() {
  return campoCategoria.value === "Mercado";
}

// Mercado pago no Pix não usa banco: o campo some e o gasto fica como Pix
function semBanco() {
  return ehBoleto() || (ehMercado() && pagandoPix());
}

// "Banco" vira "Cartão" quando a compra é no cartão (ou é uma assinatura, que sempre é cobrada no cartão)
function atualizarRotuloBanco() {
  const assinatura = campoCategoria.value === "Assinatura";
  const cartao = assinatura || campoForma.value === "cartao";
  rotuloBanco.textContent = assinatura ? "Cartão da assinatura" : cartao ? (ehMercado() ? "Cartão usado" : "Cartão") : "Banco";
  rotuloOutroBanco.textContent = cartao ? "Nome do cartão" : "Nome do banco";
}

function atualizarBanco() {
  grupoBanco.classList.toggle("oculto", semBanco());
}

function hojeEmTexto() {
  const agora = new Date();
  return agora.getFullYear() + "-" + String(agora.getMonth() + 1).padStart(2, "0") + "-" + String(agora.getDate()).padStart(2, "0");
}

// Textos do formulário conforme o boleto escolhido
function atualizarBoleto() {
  const boleto = ehBoleto();
  const compras = boleto && campoTipoBoleto.value === "compras";

  grupoBoleto.classList.toggle("oculto", !boleto);
  campoTipoBoleto.required = boleto;
  grupoParcelasBoleto.classList.toggle("oculto", !compras);
  campoParcelasBoleto.required = compras;
  if (!compras) campoParcelasBoleto.value = "";
  if (typeof limparErro === "function") limparErro(campoParcelasBoleto);

  atualizarBanco();

  // Assinatura: o nome é o do serviço e o banco é o cartão em que ela é cobrada
  const assinatura = campoCategoria.value === "Assinatura";
  const mercado = ehMercado();
  rotuloPlataforma.textContent = boleto ? "Nome do boleto" : assinatura ? "Nome da assinatura" : mercado ? "Nome do mercado" : "Plataforma ou loja";
  campoPlataforma.placeholder = boleto ? (compras ? "Ex: Geladeira" : "Ex: Conta de luz") : assinatura ? "Ex: Netflix, Spotify, Disney+" : mercado ? "Ex: Carrefour, Assaí, Atacadão" : "Ex: iFood, Amazon, Magalu";
  atualizarRotuloBanco();
  rotuloData.textContent = boleto ? (compras ? "Vencimento da 1ª parcela" : "Vencimento (se repete todo mês)") : "Data da compra";
  rotuloValor.textContent = compras ? "Valor total (R$)" : "Valor (R$)";
}

campoTipoBoleto.addEventListener("change", atualizarBoleto);

// Pix não tem parcelas. Assinatura tem periodicidade no lugar, então ignora a forma de pagamento.
function pagandoPix() {
  return campoCategoria.value !== "Assinatura" && !ehBoleto() && campoForma.value === "pix";
}

// Valor de "parcelas" que vai para o banco
function valorParcelas() {
  return pagandoPix() ? "pix" : campoParcelas.value;
}

// Esconde o vencimento se for Pix, sem parcelas ou se ainda não escolheu
function atualizarVencimento() {
  const valor = valorParcelas();
  const assinatura = campoCategoria.value === "Assinatura";
  // Assinatura cobra no mesmo dia da data da compra, então não precisa do dia de vencimento
  const semVencimento = assinatura || ehBoleto() || valor === "" || valor === "pix" || valor === "avista";
  grupoVencimento.classList.toggle("oculto", semVencimento);
}

campoParcelas.addEventListener("change", atualizarVencimento);

// Escolhendo Pix, o campo Parcelas some
function atualizarForma() {
  const pix = pagandoPix();
  grupoParcelas.classList.toggle("oculto", pix || ehMercado());
  if (pix) {
    campoParcelas.value = "";
    if (typeof limparErro === "function") limparErro(campoParcelas);
  }
  // Mercado não tem parcelas: fica "Sem parcelas" sem perguntar
  if (ehMercado()) campoParcelas.value = "avista";
  atualizarBanco();
  atualizarRotuloBanco();
  atualizarVencimento();
}

campoForma.addEventListener("change", atualizarForma);

// Se a categoria for Assinatura, "Parcelas" vira "Periodicidade" (mensal, trimestral ou anual)
function atualizarCategoria() {
  const assinatura = campoCategoria.value === "Assinatura";

  campoParcelas.innerHTML = assinatura ? opcoesAssinatura : opcoesParcelas;
  rotuloParcelas.textContent = assinatura ? "Periodicidade" : "Parcelas";

  // "+ Nova categoria": aparece uma caixa embaixo para a pessoa digitar o nome
  const criandoNova = campoCategoria.value === NOVA_CATEGORIA;
  grupoNovaCategoria.classList.toggle("oculto", !criandoNova);
  campoNovaCategoria.required = criandoNova;
  if (!criandoNova) campoNovaCategoria.value = "";
  if (typeof limparErro === "function") limparErro(campoNovaCategoria);
  if (criandoNova) campoNovaCategoria.focus();

  // Tira o aviso de erro antigo do campo, se existir (vem do validacao.js)
  if (typeof limparErro === "function") limparErro(campoParcelas);

  // Assinatura e boleto não usam a forma de pagamento; boleto também não usa parcelas nem banco
  const boleto = ehBoleto();
  grupoForma.classList.toggle("oculto", assinatura || boleto);
  if (!boleto) campoTipoBoleto.value = "";
  atualizarBoleto();
  atualizarForma();
  grupoParcelas.classList.toggle("oculto", boleto || pagandoPix() || ehMercado());

  // Mercado já vem com a data de hoje
  if (ehMercado() && !document.getElementById("data").value) document.getElementById("data").value = hojeEmTexto();
}

campoCategoria.addEventListener("change", atualizarCategoria);

form.addEventListener("submit", async function (evento) {
  evento.preventDefault();

  const boleto = ehBoleto();
  const comprasBoleto = boleto && campoTipoBoleto.value === "compras";

  // Boleto de compras: o número de parcelas tem que ser inteiro de 1 a 60
  if (comprasBoleto) {
    const n = Number(campoParcelasBoleto.value);
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      if (typeof limparErro === "function") limparErro(campoParcelasBoleto);
      if (typeof mostrarErro === "function") mostrarErro(campoParcelasBoleto, "Digite um número de 1 a 60.");
      campoParcelasBoleto.focus();
      return;
    }
  }

  const parcelas = boleto ? (comprasBoleto ? String(Number(campoParcelasBoleto.value)) : "mensal") : valorParcelas();
  const semVencimento = boleto || parcelas === "pix" || parcelas === "avista" || campoCategoria.value === "Assinatura";

  // Categoria: a da lista ou a nova que a pessoa digitou
  let categoria = campoCategoria.value;
  if (categoria === NOVA_CATEGORIA) {
    const resultado = validarNovaCategoria(campoNovaCategoria.value, CATEGORIAS_PADRAO.concat(personalizadas));
    if (typeof limparErro === "function") limparErro(campoNovaCategoria);
    if (!resultado.ok) {
      if (typeof mostrarErro === "function") mostrarErro(campoNovaCategoria, resultado.erro);
      campoNovaCategoria.focus();
      return;
    }
    categoria = resultado.nome;
  }

  const gasto = {
    plataforma: document.getElementById("plataforma").value.trim(),
    categoria: categoria,
    parcelas: parcelas,
    data: document.getElementById("data").value,
    valor: parseFloat(document.getElementById("valor").value),
    vencimento: semVencimento ? null : Number(campoVencimento.value),
    banco: boleto ? "Boleto" : (ehMercado() && pagandoPix()) ? "Pix" : document.getElementById("banco").value
  };

  // "Outro": usa o nome que a pessoa digitou (se for de um banco da lista, usa o nome da lista)
  if (gasto.banco === "Outro") {
    const digitado = campoOutroBanco.value.replace(/\s+/g, " ").trim();
    if (digitado.length < 2) {
      if (typeof limparErro === "function") limparErro(campoOutroBanco);
      if (typeof mostrarErro === "function") mostrarErro(campoOutroBanco, "Digite o nome do banco.");
      campoOutroBanco.focus();
      return;
    }
    const conhecido = BANCOS.find(function (b) { return normalizarNome(b.nome) === normalizarNome(digitado); });
    gasto.banco = conhecido ? conhecido.nome : digitado;
  }

  // Salva no banco de dados
  const botao = form.querySelector('button[type="submit"]');
  const textoBotao = botao.textContent;
  botao.disabled = true;
  botao.textContent = "Salvando...";

  try {
    await adicionarGasto(gasto);
  } catch (falha) {
    console.error(falha);
    botao.disabled = false;
    botao.textContent = textoBotao;
    sucesso.classList.add("falha");
    sucesso.textContent = "Não foi possível salvar. Tente de novo.";
    return;
  }

  botao.disabled = false;
  botao.textContent = textoBotao;
  sucesso.classList.remove("falha");

  // Categoria nova: já entra na lista para os próximos gastos
  const jaExiste = CATEGORIAS_PADRAO.concat(personalizadas).some(function (c) {
    return normalizarNome(c) === normalizarNome(categoria);
  });
  if (!jaExiste) {
    personalizadas.push(categoria);
    adicionarOpcaoCategoria(categoria);
  }

  form.reset();
  atualizarCategoria();

  sucesso.textContent = "Gasto adicionado! Veja no Dashboard.";
  setTimeout(function () {
    sucesso.textContent = "";
  }, 4000);
});

// ----- Data da compra: o botão (e o próprio campo) abrem o calendário -----
const campoData = document.getElementById("data");

function abrirCalendario() {
  campoData.focus();
  try {
    campoData.showPicker();
  } catch (falha) {
    // navegador sem showPicker: o foco no campo já deixa digitar a data
  }
}

document.getElementById("btn-calendario").addEventListener("click", abrirCalendario);
campoData.addEventListener("click", abrirCalendario);

// ----- Banco com ícone -----
// O <select> de verdade fica escondido (a validação e o envio continuam iguais);
// a pessoa mexe nesta lista com os ícones, que preenche o <select> por baixo.
const campoBanco = document.getElementById("banco");
const botaoBanco = document.getElementById("banco-botao");
const valorBanco = document.getElementById("banco-valor");
const listaBanco = document.getElementById("banco-lista");
const painelBanco = document.getElementById("banco-painel");
const campoBusca = document.getElementById("banco-busca");
const avisoSemBanco = document.getElementById("banco-vazio");

BANCOS.forEach(function (b) {
  campoBanco.add(new Option(b.nome, b.nome));

  const item = document.createElement("li");
  item.setAttribute("role", "option");
  item.tabIndex = -1;
  item.dataset.valor = b.nome;
  item.innerHTML = iconeBanco(b.nome) + "<span>" + b.nome + "</span>";
  listaBanco.appendChild(item);
});

// Escolhendo "Outro", aparece uma caixa para escrever o nome do banco
const grupoOutroBanco = document.getElementById("grupo-outro-banco");
const campoOutroBanco = document.getElementById("outro-banco");

function atualizarOutroBanco() {
  const outro = campoBanco.value === "Outro";
  grupoOutroBanco.classList.toggle("oculto", !outro);
  if (!outro) {
    campoOutroBanco.value = "";
    if (typeof limparErro === "function") limparErro(campoOutroBanco);
  }
}

campoBanco.addEventListener("change", function () {
  atualizarOutroBanco();
  if (campoBanco.value === "Outro") campoOutroBanco.focus();
});

function mostrarBanco() {
  const nome = campoBanco.value;
  valorBanco.innerHTML = nome ? iconeBanco(nome) + "<span>" + nome + "</span>" : "Escolha";
  listaBanco.querySelectorAll("li").forEach(function (li) {
    li.setAttribute("aria-selected", String(li.dataset.valor === nome));
  });
}

function abrirListaBanco(abrir) {
  painelBanco.classList.toggle("oculto", !abrir);
  if (abrir) {
    // A lista cresce a página: rola um pouco para ela aparecer inteira (espera a página liberar a rolagem)
    setTimeout(function () {
      painelBanco.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 80);

    // No computador a pesquisa já fica pronta para digitar; no celular não abre o teclado sozinha
    if (window.matchMedia("(hover: hover)").matches) campoBusca.focus();
  } else {
    campoBusca.value = "";
    filtrarBancos();
  }
  botaoBanco.classList.toggle("aberto", abrir);
  botaoBanco.setAttribute("aria-expanded", String(abrir));
}

function escolherBanco(nome) {
  campoBanco.value = nome;
  // Avisa o formulário (some o aviso de campo obrigatório, por exemplo)
  campoBanco.dispatchEvent(new Event("change", { bubbles: true }));
  mostrarBanco();
  abrirListaBanco(false);
  botaoBanco.focus();
}

// Pesquisa: mostra só os bancos cujo nome tem o que a pessoa digitou (sem ligar para acento ou maiúscula)
function filtrarBancos() {
  const busca = normalizarNome(campoBusca.value);
  let achou = 0;
  listaBanco.querySelectorAll("li").forEach(function (li) {
    const aparece = normalizarNome(li.dataset.valor).includes(busca);
    li.hidden = !aparece;
    if (aparece) achou++;
  });
  avisoSemBanco.classList.toggle("oculto", achou > 0);
}

campoBusca.addEventListener("input", filtrarBancos);

campoBusca.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    // Enter não envia o formulário: escolhe o primeiro banco encontrado
    e.preventDefault();
    const primeiro = listaBanco.querySelector("li:not([hidden])");
    if (primeiro) escolherBanco(primeiro.dataset.valor);
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    focarItemBanco(0);
  } else if (e.key === "Escape") {
    e.preventDefault();
    abrirListaBanco(false);
    botaoBanco.focus();
  }
});

function focarItemBanco(indice) {
  const itens = listaBanco.querySelectorAll("li:not([hidden])");
  if (itens[indice]) itens[indice].focus();
}

botaoBanco.addEventListener("click", function () {
  abrirListaBanco(painelBanco.classList.contains("oculto"));
});

botaoBanco.addEventListener("keydown", function (e) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    abrirListaBanco(painelBanco.classList.contains("oculto"));
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    abrirListaBanco(true);
    const itens = Array.from(listaBanco.querySelectorAll("li:not([hidden])"));
    const atual = itens.findIndex(function (li) { return li.dataset.valor === campoBanco.value; });
    focarItemBanco(Math.max(atual, 0));
  } else if (e.key === "Escape") {
    abrirListaBanco(false);
  }
});

listaBanco.addEventListener("click", function (e) {
  const item = e.target.closest("li");
  if (item) escolherBanco(item.dataset.valor);
});

listaBanco.addEventListener("keydown", function (e) {
  const itens = Array.from(listaBanco.querySelectorAll("li:not([hidden])"));
  const indice = itens.indexOf(document.activeElement);

  if (e.key === "ArrowDown") {
    e.preventDefault();
    focarItemBanco(Math.min(indice + 1, itens.length - 1));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    focarItemBanco(Math.max(indice - 1, 0));
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    if (indice >= 0) escolherBanco(itens[indice].dataset.valor);
  } else if (e.key === "Escape") {
    abrirListaBanco(false);
    botaoBanco.focus();
  }
});

// Clicar fora fecha a lista
document.addEventListener("click", function (e) {
  if (!e.target.closest(".select-banco")) abrirListaBanco(false);
});

// Se a validação do formulário mandar o foco para o campo escondido, ele vai para o botão
campoBanco.addEventListener("focus", function () {
  botaoBanco.focus();
});

// Depois de limpar o formulário, o texto do botão volta para "Escolha"
form.addEventListener("reset", function () {
  setTimeout(function () {
    mostrarBanco();
    atualizarOutroBanco();
    abrirListaBanco(false);
  }, 0);
});

mostrarBanco();
atualizarCategoria();

// No espaço compartilhado só valem Boleto, Assinatura e Mercado; no lado pessoal, as categorias da pessoa
escopoAtual().then(function (espaco) {
  if (espaco) {
    campoCategoria.innerHTML =
      '<option value="" disabled selected>Escolha</option>' +
      CATEGORIAS_ESPACO.map(function (nome) { return "<option>" + nome + "</option>"; }).join("");
    atualizarCategoria();

    const subtitulo = document.querySelector(".topo-centralizado p");
    if (subtitulo) subtitulo.textContent = "Adicionando no espaço " + espaco.nome + " (todos os membros veem)";
    return;
  }

  // Coloca na lista as categorias que a pessoa já criou
  return buscarCategoriasUsadas().then(function (usadas) {
    categoriasPersonalizadas(usadas).forEach(function (nome) {
      if (!personalizadas.includes(nome)) {
        personalizadas.push(nome);
        adicionarOpcaoCategoria(nome);
      }
    });
  });
}).catch(function (falha) {
  console.error(falha);
});
