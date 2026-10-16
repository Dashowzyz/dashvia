// Botões da tela Adicionar: categoria, pagamento, parcelas, data e bancos.
// Os campos originais do formulário continuam lá (escondidos só da vista) e são eles que guardam os valores:
// cada botão apenas preenche o campo e avisa a tela com um evento "change". Assim todas as regras de
// adicionar.js (Pix sem parcelas, assinatura, boleto, espaço compartilhado...) continuam valendo.
// Carregado depois de adicionar.js, gasto-formulario.js e bancos.js.
(function () {
  // Ícones desenhados (mesmo traço dos outros ícones do app)
  const SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  function icone(caminhos) { return SVG + caminhos + "</svg>"; }

  const ICONE_MAIS = icone('<path d="M12 5v14"/><path d="M5 12h14"/>');
  const ICONE_ETIQUETA = icone('<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1"/>');
  const ICONE_REPETIR = icone('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>');
  const ICONES_CATEGORIA = {
    "Alimentação": icone('<path d="M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3zm0 0v7"/>'),
    "Compras": icone('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
    "Transportes": icone('<path d="M19 17h2a1 1 0 0 0 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5a1.6 1.6 0 0 0-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4a1 1 0 0 0 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'),
    "Assinatura": ICONE_REPETIR,
    "Mercado": icone('<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 7H5.1"/>'),
    "Outros": ICONE_ETIQUETA
  };
  const ICONE_CARTAO = icone('<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/><path d="M6 15h4"/>');
  const ICONE_PIX = icone('<path d="M12 3l3.5 3.5L12 10 8.5 6.5z"/><path d="M12 14l3.5 3.5L12 21l-3.5-3.5z"/><path d="M3 12l3.5-3.5L10 12l-3.5 3.5z"/><path d="M14 12l3.5-3.5L21 12l-3.5 3.5z"/>');
  const ICONE_BOLETO_CHIP = icone('<path d="M4 6v12"/><path d="M8 6v12"/><path d="M11 6v12"/><path d="M15 6v12"/><path d="M18 6v12"/><path d="M21 6v12"/>');
  const ICONE_PARCELADO = icone('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>');
  const BANCOS_PRINCIPAIS = ["Nubank", "Itaú", "Inter", "Bradesco", "Banco do Brasil", "Santander", "Caixa", "C6 Bank"];
  const PARCELAS_RAPIDAS = ["avista", "2", "3", "4", "5", "6", "12"];
  const PARCELAS_BOLETO_RAPIDAS = ["2", "3", "4", "6", "10", "12"];
  const campoData = document.getElementById("data");
  const seletorBanco = document.querySelector(".select-banco");
  let categoriaAntesDoBoleto = "";

  // ---------- Peças ----------

  // Some da vista, mas continua "visível" para a validação do formulário (validacao.js)
  function esconderDaVista(el) {
    el.classList.add("visualmente-oculto");
    el.tabIndex = -1;
  }

  function avisar(el, tipo) {
    el.dispatchEvent(new Event(tipo || "change", { bubbles: true }));
  }

  function novaFaixa(rotulo, classeExtra) {
    const faixa = document.createElement("div");
    faixa.className = "chips" + (classeExtra ? " " + classeExtra : "");
    faixa.setAttribute("role", "group");
    faixa.setAttribute("aria-label", rotulo);
    return faixa;
  }

  // icone: texto (emoji) ou HTML de confiança (o selinho do banco, de bancos.js)
  function novoChip(texto, valor, icone) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.dataset.valor = valor;
    b.setAttribute("aria-pressed", "false");
    if (icone) {
      const i = document.createElement("span");
      i.className = "chip-icone";
      i.setAttribute("aria-hidden", "true");
      i.innerHTML = icone;
      b.appendChild(i);
    }
    const rotulo = document.createElement("span");
    rotulo.className = "chip-texto";
    rotulo.textContent = texto;
    b.appendChild(rotulo);
    return b;
  }

  function marcar(faixa, valor) {
    faixa.querySelectorAll(".chip").forEach(function (c) {
      c.setAttribute("aria-pressed", String(valor !== null && c.dataset.valor === valor));
    });
  }

  function aoTocar(faixa, acao) {
    faixa.addEventListener("click", function (e) {
      const chip = e.target.closest(".chip");
      if (chip && faixa.contains(chip)) acao(chip.dataset.valor, chip);
    });
  }

  function hojeMais(dias) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // Grade em páginas de 6 (3 colunas x 2 linhas), com setas, bolinhas e arraste para o lado.
  // Usada nas categorias e nos bancos. opcoes: { voltar, avancar, antes(), decorar(chip, item), depois() }
  const POR_PAGINA = 6;
  function criarPaginas(faixa, opcoes) {
    let pagina = 0;
    let itens = [];
    const nav = document.createElement("div");
    nav.className = "cat-nav";
    nav.hidden = true;
    nav.innerHTML =
      '<button type="button" class="cat-seta" data-ir="-1" aria-label="' + opcoes.voltar + '">' + icone('<path d="m15 18-6-6 6-6"/>') + "</button>" +
      '<span class="cat-pontos" aria-hidden="true"></span>' +
      '<button type="button" class="cat-seta" data-ir="1" aria-label="' + opcoes.avancar + '">' + icone('<path d="m9 18 6-6-6-6"/>') + "</button>";
    faixa.insertAdjacentElement("afterend", nav);
    const pontos = nav.querySelector(".cat-pontos");

    function total() {
      return Math.max(1, Math.ceil(itens.length / POR_PAGINA));
    }

    function paginaDoValor(valor) {
      const i = itens.findIndex(function (item) { return item.valor === valor; });
      return i === -1 ? null : Math.floor(i / POR_PAGINA);
    }

    function desenhar(direcao) {
      if (opcoes.antes) opcoes.antes();
      const n = total();
      pagina = Math.min(Math.max(pagina, 0), n - 1);
      faixa.textContent = "";
      itens.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).forEach(function (item) {
        const chip = novoChip(item.texto, item.valor, item.icone);
        if (opcoes.decorar) opcoes.decorar(chip, item);
        faixa.appendChild(chip);
      });
      faixa.classList.remove("cat-vem-direita", "cat-vem-esquerda");
      if (direcao) {
        void faixa.offsetWidth; // reinicia a animação
        faixa.classList.add(direcao > 0 ? "cat-vem-direita" : "cat-vem-esquerda");
      }
      nav.hidden = n <= 1;
      // com mais de uma página, a grade guarda sempre as 2 linhas (a tela não pula ao trocar de página)
      faixa.classList.toggle("cat-varias-paginas", n > 1);
      nav.querySelector('[data-ir="-1"]').disabled = pagina === 0;
      nav.querySelector('[data-ir="1"]').disabled = pagina === n - 1;
      pontos.innerHTML = Array.from({ length: n }, function (_, i) {
        return '<span class="' + (i === pagina ? "ativo" : "") + '"></span>';
      }).join("");
      if (opcoes.depois) opcoes.depois();
    }

    function ir(direcao) {
      const nova = pagina + direcao;
      if (nova < 0 || nova >= total()) return;
      pagina = nova;
      desenhar(direcao);
    }

    nav.addEventListener("click", function (e) {
      const seta = e.target.closest(".cat-seta");
      if (seta && !seta.disabled) ir(Number(seta.dataset.ir));
    });

    // arrastar com o dedo para o lado também troca de página (e não conta como toque num botão)
    let inicio = null;
    let arrastou = false;
    faixa.addEventListener("pointerdown", function (e) {
      inicio = { x: e.clientX, y: e.clientY };
      arrastou = false;
    });
    faixa.addEventListener("pointerup", function (e) {
      if (!inicio) return;
      const dx = e.clientX - inicio.x;
      const dy = e.clientY - inicio.y;
      inicio = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5 && total() > 1) {
        arrastou = true;
        ir(dx < 0 ? 1 : -1);
      }
    });
    faixa.addEventListener("click", function (e) {
      if (arrastou) {
        e.stopImmediatePropagation();
        arrastou = false;
      }
    }, true);

    return {
      nav: nav,
      itens: function () { return itens; },
      definir: function (lista) { itens = lista; },
      desenhar: desenhar,
      // vai até a página do valor; devolve true se trocou de página
      mostrarValor: function (valor, animar) {
        const p = paginaDoValor(valor);
        if (p === null || p === pagina) return false;
        const direcao = p > pagina ? 1 : -1;
        pagina = p;
        desenhar(animar ? direcao : 0);
        return true;
      }
    };
  }

  // ---------- Categoria: botões, todos à vista (a lista de escolher fica por baixo) ----------
  const faixaCategoria = novaFaixa("Categoria", "chips-categoria");
  const dicaBoleto = document.createElement("p");
  dicaBoleto.className = "dica-campo";
  dicaBoleto.hidden = true;
  dicaBoleto.textContent = "Boletos ficam na categoria Boleto. Para usar outra categoria, escolha Crédito ou Pix.";
  campoCategoria.insertAdjacentElement("beforebegin", faixaCategoria);
  faixaCategoria.insertAdjacentElement("afterend", dicaBoleto);
  esconderDaVista(campoCategoria);

  const paginasCategoria = criarPaginas(faixaCategoria, {
    voltar: "Categorias anteriores",
    avancar: "Mais categorias",
    // não sobrou categoria criada: sai do modo Editar (senão a grade fica toda apagada e travada)
    antes: function () {
      if (editandoCategorias && !temCriadas()) {
        editandoCategorias = false;
        botaoEditar.textContent = "Editar";
        botaoEditar.setAttribute("aria-pressed", "false");
      }
    },
    // no modo Editar: as criadas ganham o "×", as fixas ficam apagadas
    decorar: function (chip, item) {
      if (!editandoCategorias) return;
      if (podeRemover(item.valor)) {
        chip.classList.add("cat-removivel");
        chip.setAttribute("aria-label", "Remover a categoria " + item.texto);
        const x = document.createElement("span");
        x.className = "cat-x";
        x.setAttribute("aria-hidden", "true");
        x.innerHTML = icone('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');
        chip.appendChild(x);
      } else {
        chip.classList.add("cat-fixa");
        chip.disabled = true;
      }
    },
    depois: function () {
      botaoEditar.hidden = !temCriadas();
      sincronizar();
    }
  });

  function montarCategorias() {
    const lista = [];
    Array.prototype.forEach.call(campoCategoria.options, function (o) {
      if (o.disabled && !o.value) return; // "Escolha"
      if (o.value === "Boleto") return;    // boleto fica na forma de pagamento
      const nova = o.value === NOVA_CATEGORIA;
      lista.push({ texto: nova ? "Nova" : o.text, valor: o.value, icone: nova ? ICONE_MAIS : (ICONES_CATEGORIA[o.value] || ICONE_ETIQUETA) });
    });
    paginasCategoria.definir(lista);
    if (!paginasCategoria.mostrarValor(campoCategoria.value, false)) paginasCategoria.desenhar(0);
  }

  // escolhida por outro caminho (ex.: voltar do boleto): mostra a página dela
  campoCategoria.addEventListener("change", function () {
    paginasCategoria.mostrarValor(campoCategoria.value, true);
  });

  aoTocar(faixaCategoria, function (valor) {
    if (editandoCategorias) {
      if (podeRemover(valor)) pedirRemocao(valor);
      return;
    }
    campoCategoria.value = valor;
    avisar(campoCategoria);
  });

  // ---------- Remover categoria criada (botão "Editar") ----------
  let editandoCategorias = false;
  const rotuloCategoria = document.querySelector('label[for="categoria"]');
  const cabecaCategoria = document.createElement("div");
  cabecaCategoria.className = "cat-cabeca";
  rotuloCategoria.insertAdjacentElement("beforebegin", cabecaCategoria);
  cabecaCategoria.appendChild(rotuloCategoria);
  const botaoEditar = document.createElement("button");
  botaoEditar.type = "button";
  botaoEditar.className = "cat-editar";
  botaoEditar.textContent = "Editar";
  botaoEditar.hidden = true;
  cabecaCategoria.appendChild(botaoEditar);
  const avisoCategoria = document.createElement("p");
  avisoCategoria.className = "cat-aviso";
  avisoCategoria.setAttribute("role", "status");
  avisoCategoria.hidden = true;
  paginasCategoria.nav.insertAdjacentElement("afterend", avisoCategoria);

  function podeRemover(valor) {
    return valor !== NOVA_CATEGORIA && !ehCategoriaPadrao(valor);
  }

  function temCriadas() {
    return paginasCategoria.itens().some(function (item) { return podeRemover(item.valor); });
  }

  function mostrarAvisoCategoria(texto, erro) {
    avisoCategoria.textContent = texto;
    avisoCategoria.classList.toggle("erro", !!erro);
    avisoCategoria.hidden = false;
  }

  function definirEdicao(ligar) {
    editandoCategorias = ligar && temCriadas();
    botaoEditar.textContent = editandoCategorias ? "Concluir" : "Editar";
    botaoEditar.setAttribute("aria-pressed", String(editandoCategorias));
    paginasCategoria.desenhar(0);
  }

  botaoEditar.addEventListener("click", function () {
    avisoCategoria.hidden = true;
    definirEdicao(!editandoCategorias);
  });

  async function pedirRemocao(nome) {
    let quantos = null;
    try {
      quantos = await contarGastosDaCategoria(nome);
    } catch (falha) {
      console.error(falha);
    }
    const quantosTexto = quantos === null ? "Os gastos dela vão" : quantos === 1 ? "1 gasto vai" : quantos + " gastos vão";
    const pergunta = "Remover a categoria \"" + nome + "\"? " + quantosTexto + " para Outros. Nenhum gasto é apagado.";
    if (!(await confirmar(pergunta, "Remover"))) return;

    try {
      const mudaram = await removerCategoria(nome);
      const eraEscolhida = campoCategoria.value === nome;
      const opcao = Array.prototype.find.call(campoCategoria.options, function (o) { return o.value === nome; });
      const posicao = personalizadas.indexOf(nome);
      if (posicao !== -1) personalizadas.splice(posicao, 1);
      if (opcao) opcao.remove(); // a grade se refaz sozinha
      if (eraEscolhida) {
        campoCategoria.selectedIndex = 0;
        avisar(campoCategoria);
      }
      if (!temCriadas()) definirEdicao(false);
      mostrarAvisoCategoria("Categoria \"" + nome + "\" removida." + (mudaram ? " " + (mudaram === 1 ? "1 gasto foi" : mudaram + " gastos foram") + " para Outros." : ""));
    } catch (falha) {
      console.error(falha);
      mostrarAvisoCategoria("Não foi possível remover a categoria. Tente de novo.", true);
    }
  }

  // ---------- Forma de pagamento (Crédito, Pix, Boleto) ----------
  const grupoPagamento = document.createElement("div");
  grupoPagamento.id = "grupo-pagamento";
  const rotuloPagamento = document.createElement("label");
  rotuloPagamento.textContent = "Forma de pagamento";
  const faixaPagamento = novaFaixa("Forma de pagamento");
  faixaPagamento.appendChild(novoChip("Crédito", "cartao", ICONE_CARTAO));
  faixaPagamento.appendChild(novoChip("Pix", "pix", ICONE_PIX));
  faixaPagamento.appendChild(novoChip("Boleto", "boleto", ICONE_BOLETO_CHIP));
  grupoPagamento.appendChild(rotuloPagamento);
  grupoPagamento.appendChild(faixaPagamento);
  grupoForma.insertAdjacentElement("beforebegin", grupoPagamento);
  // as opções do boleto aparecem logo depois de escolher "Boleto" (na página original elas ficam no topo)
  grupoPagamento.insertAdjacentElement("afterend", grupoBoleto);
  const rotuloFormaOriginal = grupoForma.querySelector("label");
  if (rotuloFormaOriginal) rotuloFormaOriginal.classList.add("visualmente-oculto");
  esconderDaVista(campoForma);

  aoTocar(faixaPagamento, function (valor) {
    if (valor === "boleto") {
      if (campoCategoria.value === "Boleto") return;
      categoriaAntesDoBoleto = campoCategoria.value;
      campoCategoria.value = "Boleto";
      avisar(campoCategoria);
      return;
    }
    // saindo do boleto: volta a categoria que estava escolhida antes
    if (campoCategoria.value === "Boleto") {
      campoCategoria.value = categoriaAntesDoBoleto;
      if (campoCategoria.value !== categoriaAntesDoBoleto || !categoriaAntesDoBoleto) campoCategoria.selectedIndex = 0;
      avisar(campoCategoria);
    }
    campoForma.value = valor;
    avisar(campoForma);
  });

  // ---------- Tipo do boleto (todo mês ou compra parcelada) ----------
  const faixaTipoBoleto = novaFaixa("Tipo do boleto");
  faixaTipoBoleto.appendChild(novoChip("Todo mês", "residencial", ICONE_REPETIR));
  faixaTipoBoleto.appendChild(novoChip("Compra parcelada", "compras", ICONE_PARCELADO));
  campoTipoBoleto.insertAdjacentElement("beforebegin", faixaTipoBoleto);
  esconderDaVista(campoTipoBoleto);
  aoTocar(faixaTipoBoleto, function (valor) {
    campoTipoBoleto.value = valor;
    avisar(campoTipoBoleto);
  });

  // ---------- Parcelas do boleto parcelado: botões + a caixa de número que já existe ----------
  const faixaParcelasBoleto = novaFaixa("Parcelas do boleto", "chips-iguais chips-compactas");
  PARCELAS_BOLETO_RAPIDAS.forEach(function (n) { faixaParcelasBoleto.appendChild(novoChip(n + "x", n)); });
  const caixaBoleto = document.createElement("div");
  caixaBoleto.className = "parcelas-outra";
  campoParcelasBoleto.insertAdjacentElement("beforebegin", faixaParcelasBoleto);
  campoParcelasBoleto.insertAdjacentElement("beforebegin", caixaBoleto);
  caixaBoleto.appendChild(campoParcelasBoleto);
  campoParcelasBoleto.placeholder = "Outra quantidade (1 a 60)";
  aoTocar(faixaParcelasBoleto, function (valor) {
    campoParcelasBoleto.value = valor;
    avisar(campoParcelasBoleto, "input");
  });

  // ---------- Parcelas (crédito) ou periodicidade (assinatura) ----------
  const faixaParcelas = novaFaixa("Parcelas", "chips-iguais chips-compactas");
  const caixaParcelas = document.createElement("div");
  caixaParcelas.className = "parcelas-outra";
  const campoOutraParcela = document.createElement("input");
  campoOutraParcela.type = "text";
  campoOutraParcela.inputMode = "numeric";
  campoOutraParcela.maxLength = 2;
  campoOutraParcela.placeholder = "Outra quantidade (1 a 60)";
  campoOutraParcela.setAttribute("aria-label", "Outra quantidade de parcelas, de 1 a 60");
  caixaParcelas.appendChild(campoOutraParcela);
  const erroParcela = document.createElement("span");
  erroParcela.className = "erro-campo";
  erroParcela.hidden = true;
  erroParcela.textContent = "Digite um número de 1 a 60.";
  campoParcelas.insertAdjacentElement("beforebegin", faixaParcelas);
  campoParcelas.insertAdjacentElement("beforebegin", caixaParcelas);
  caixaParcelas.insertAdjacentElement("afterend", erroParcela);
  esconderDaVista(campoParcelas);

  let modoParcelas = "";
  function emAssinatura() {
    return Array.prototype.some.call(campoParcelas.options, function (o) { return o.value === "mensal"; });
  }

  function montarParcelas() {
    const modo = emAssinatura() ? "assinatura" : "parcelas";
    if (modo === modoParcelas) return sincronizar();
    modoParcelas = modo;
    faixaParcelas.textContent = "";
    if (modo === "assinatura") {
      Array.prototype.forEach.call(campoParcelas.options, function (o) {
        if (o.value) faixaParcelas.appendChild(novoChip(o.text, o.value));
      });
    } else {
      PARCELAS_RAPIDAS.forEach(function (v) { faixaParcelas.appendChild(novoChip(v === "avista" ? "À vista" : v + "x", v)); });
    }
    caixaParcelas.classList.toggle("oculto", modo === "assinatura");
    campoOutraParcela.value = "";
    erroParcela.hidden = true;
    sincronizar();
  }

  function escolherParcela(valor) {
    // quantidade digitada que não está na lista (ex.: 24): cria a opção para o campo aceitar
    if (!Array.prototype.some.call(campoParcelas.options, function (o) { return o.value === valor; })) {
      campoParcelas.add(new Option(valor + "x", valor));
    }
    campoParcelas.value = valor;
    avisar(campoParcelas);
  }

  aoTocar(faixaParcelas, function (valor) {
    campoOutraParcela.value = "";
    erroParcela.hidden = true;
    escolherParcela(valor);
  });

  campoOutraParcela.addEventListener("input", function () {
    campoOutraParcela.value = campoOutraParcela.value.replace(/\D/g, "");
    const texto = campoOutraParcela.value;
    if (texto === "") {
      erroParcela.hidden = true;
      return;
    }
    const n = parcelasDigitadas(texto);
    erroParcela.hidden = n !== null;
    if (n === null) {
      campoParcelas.selectedIndex = 0; // sem valor: o formulário não deixa salvar
      avisar(campoParcelas);
      return;
    }
    escolherParcela(n === 1 ? "avista" : String(n));
  });

  // ---------- Data: Hoje e Ontem ----------
  const faixaData = novaFaixa("Atalhos de data", "chips-iguais");
  faixaData.appendChild(novoChip("Hoje", "0"));
  faixaData.appendChild(novoChip("Ontem", "-1"));
  document.querySelector(".campo-data").insertAdjacentElement("afterend", faixaData);
  aoTocar(faixaData, function (valor) {
    campoData.value = hojeMais(Number(valor));
    avisar(campoData, "input");
    avisar(campoData);
  });

  // ---------- Banco: os mais usados em botões e "Outros bancos" abre a lista com pesquisa ----------
  const faixaBanco = novaFaixa("Banco", "chips-categoria");
  seletorBanco.insertAdjacentElement("beforebegin", faixaBanco);
  let mostrarLista = false;
  const paginasBanco = criarPaginas(faixaBanco, { voltar: "Bancos anteriores", avancar: "Mais bancos", depois: sincronizar });
  paginasBanco.definir(BANCOS_PRINCIPAIS.map(function (nome) {
    return { texto: nome === "Banco do Brasil" ? "BB" : nome === "C6 Bank" ? "C6" : nome, valor: nome, icone: iconeBanco(nome) };
  }).concat([{ texto: "Outros", valor: "__outros", icone: ICONE_MAIS }]));
  paginasBanco.desenhar(0);
  // banco escolhido (por um botão ou pela lista com pesquisa): mostra a página dele
  campoBanco.addEventListener("change", function () {
    const banco = campoBanco.value;
    paginasBanco.mostrarValor(BANCOS_PRINCIPAIS.indexOf(banco) !== -1 ? banco : banco ? "__outros" : null, true);
  });
  aoTocar(faixaBanco, function (valor) {
    if (valor === "__outros") {
      mostrarLista = true;
      sincronizar();
      // espera o toque terminar: senão a própria página entende como "clique fora" e fecha a lista
      setTimeout(function () { abrirListaBanco(true); }, 0);
      return;
    }
    mostrarLista = false;
    escolherBanco(valor);
    sincronizar();
  });

  // ---------- Deixa os botões iguais ao que está nos campos ----------
  function sincronizar() {
    const boleto = campoCategoria.value === "Boleto";
    const assinatura = campoCategoria.value === "Assinatura";

    marcar(faixaCategoria, boleto ? null : campoCategoria.value);
    faixaCategoria.classList.toggle("chips-apagadas", boleto);
    dicaBoleto.hidden = !boleto;


    grupoPagamento.classList.toggle("oculto", assinatura);
    marcar(faixaPagamento, boleto ? "boleto" : campoForma.value);

    marcar(faixaTipoBoleto, campoTipoBoleto.value);
    marcar(faixaParcelasBoleto, campoParcelasBoleto.value);

    // a caixa "Outra quantidade" mostra o número quando ele não tem botão
    const valorParcela = campoParcelas.value;
    marcar(faixaParcelas, valorParcela);
    if (document.activeElement !== campoOutraParcela) {
      const temBotao = PARCELAS_RAPIDAS.indexOf(valorParcela) !== -1 || modoParcelas === "assinatura";
      campoOutraParcela.value = !temBotao && /^\d+$/.test(valorParcela) ? valorParcela : "";
    }

    marcar(faixaData, campoData.value === hojeMais(0) ? "0" : campoData.value === hojeMais(-1) ? "-1" : null);

    const banco = campoBanco.value;
    const principal = BANCOS_PRINCIPAIS.indexOf(banco) !== -1;
    const outro = !!banco && !principal;
    marcar(faixaBanco, principal ? banco : (outro || mostrarLista) ? "__outros" : null);
    seletorBanco.classList.toggle("oculto", !(outro || mostrarLista));
  }

  [campoCategoria, campoForma, campoParcelas, campoTipoBoleto, campoBanco, campoData].forEach(function (campo) {
    campo.addEventListener("change", sincronizar);
  });
  [campoParcelasBoleto, campoData].forEach(function (campo) {
    campo.addEventListener("input", sincronizar);
  });

  // a lista de parcelas muda sozinha (parcelas x periodicidade da assinatura)
  new MutationObserver(montarParcelas).observe(campoParcelas, { childList: true });
  new MutationObserver(montarCategorias).observe(campoCategoria, { childList: true });

  form.addEventListener("reset", function () {
    setTimeout(function () {
      categoriaAntesDoBoleto = "";
      mostrarLista = false;
      campoOutraParcela.value = "";
      erroParcela.hidden = true;
      sincronizar();
    }, 0);
  });

  montarCategorias();
  montarParcelas();
})();
