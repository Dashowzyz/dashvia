// Seletor de cor do Dashvia: um quadrado para arrastar a bolinha, uma barra de tom e o código hex.
// Substitui a janela de cor do Android/Chrome, que o site não consegue estilizar.
//
// Uso:
//   abrirSeletorCor({
//     cor: "#7a4be0",
//     aoMudar: function (hex) { ... },      // a cada movimento (para mostrar a cor ao vivo)
//     aoConfirmar: function (hex) { ... },  // botão "Definir"
//     aoCancelar: function () { ... }       // "Cancelar", Esc ou toque fora
//   });

// ----- Contas de cor (sem tela, para poderem ser testadas) -----

function limitarNumero(n, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, n));
}

// "7A4BE0", "#abc", " #7a4be0 " -> "#7a4be0" (ou null se não for uma cor)
function normalizarHex(texto) {
  if (typeof texto !== "string") return null;
  let t = texto.trim().toLowerCase().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/.test(t)) t = t.split("").map(function (c) { return c + c; }).join("");
  return /^[0-9a-f]{6}$/.test(t) ? "#" + t : null;
}

// h em graus (0 a 360), s e v de 0 a 1
function hsvParaHex(h, s, v) {
  h = ((h % 360) + 360) % 360;
  s = limitarNumero(s, 0, 1);
  v = limitarNumero(v, 0, 1);

  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const setor = Math.floor(h / 60);
  const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][setor] || [c, 0, 0];

  return "#" + rgb.map(function (canal) {
    return Math.round((canal + m) * 255).toString(16).padStart(2, "0");
  }).join("");
}

function hexParaHsv(hex) {
  const normal = normalizarHex(hex);
  if (!normal) return null;

  const r = parseInt(normal.slice(1, 3), 16) / 255;
  const g = parseInt(normal.slice(3, 5), 16) / 255;
  const b = parseInt(normal.slice(5, 7), 16) / 255;
  const maior = Math.max(r, g, b);
  const menor = Math.min(r, g, b);
  const d = maior - menor;

  let h = 0;
  if (d !== 0) {
    if (maior === r) h = 60 * (((g - b) / d) % 6);
    else if (maior === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return { h: h || 0, s: maior === 0 ? 0 : d / maior, v: maior };
}

// ----- A janela -----

function abrirSeletorCor(opcoes) {
  const inicial = hexParaHsv(opcoes.cor) || { h: 0, s: 1, v: 1 };
  let h = inicial.h, s = inicial.s, v = inicial.v;
  const aberto = document.activeElement;

  const fundo = document.createElement("div");
  fundo.className = "sc-fundo";
  fundo.innerHTML =
    '<div class="sc-caixa" role="dialog" aria-modal="true" aria-label="Escolher cor" tabindex="-1">' +
      '<div class="sc-area" tabindex="0" role="slider" aria-label="Intensidade e brilho da cor. Use as setas."><div class="sc-bolinha"></div></div>' +
      '<div class="sc-matiz" tabindex="0" role="slider" aria-label="Tom da cor. Use as setas." aria-valuemin="0" aria-valuemax="360"><div class="sc-bolinha"></div></div>' +
      '<div class="sc-linha">' +
        '<span class="sc-previa"></span>' +
        '<input class="sc-hex" type="text" maxlength="7" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Código da cor">' +
      "</div>" +
      '<div class="sc-botoes">' +
        '<button type="button" class="sc-cancelar">Cancelar</button>' +
        '<button type="button" class="sc-definir">Definir</button>' +
      "</div>" +
    "</div>";

  const caixa = fundo.querySelector(".sc-caixa");
  const area = fundo.querySelector(".sc-area");
  const barra = fundo.querySelector(".sc-matiz");
  const bolinhaArea = area.querySelector(".sc-bolinha");
  const bolinhaMatiz = barra.querySelector(".sc-bolinha");
  const previa = fundo.querySelector(".sc-previa");
  const campoHex = fundo.querySelector(".sc-hex");

  function hexAtual() {
    return hsvParaHex(h, s, v);
  }

  // Redesenha tudo conforme h, s e v. "escreverHex" é falso enquanto a pessoa digita no campo.
  function desenhar(escreverHex) {
    const hex = hexAtual();
    area.style.backgroundColor = hsvParaHex(h, 1, 1);
    bolinhaArea.style.left = s * 100 + "%";
    bolinhaArea.style.top = (1 - v) * 100 + "%";
    bolinhaArea.style.backgroundColor = hex;
    bolinhaMatiz.style.left = (h / 360) * 100 + "%";
    bolinhaMatiz.style.top = "50%";
    bolinhaMatiz.style.backgroundColor = hsvParaHex(h, 1, 1);
    previa.style.backgroundColor = hex;
    barra.setAttribute("aria-valuenow", String(Math.round(h)));
    if (escreverHex) {
      campoHex.value = hex.toUpperCase();
      campoHex.classList.remove("invalido");
    }
  }

  function mudou() {
    desenhar(true);
    if (opcoes.aoMudar) opcoes.aoMudar(hexAtual());
  }

  // Arrastar com o dedo ou o mouse (a bolinha segue até fora da área, sem sair da borda)
  function arrastavel(elemento, aoMover) {
    let arrastando = false;
    elemento.addEventListener("pointerdown", function (e) {
      arrastando = true;
      elemento.setPointerCapture(e.pointerId);
      aoMover(e);
      e.preventDefault();
    });
    elemento.addEventListener("pointermove", function (e) {
      if (arrastando) aoMover(e);
    });
    function soltar() { arrastando = false; }
    elemento.addEventListener("pointerup", soltar);
    elemento.addEventListener("pointercancel", soltar);
  }

  arrastavel(area, function (e) {
    const r = area.getBoundingClientRect();
    s = limitarNumero((e.clientX - r.left) / r.width, 0, 1);
    v = 1 - limitarNumero((e.clientY - r.top) / r.height, 0, 1);
    mudou();
  });

  arrastavel(barra, function (e) {
    const r = barra.getBoundingClientRect();
    h = limitarNumero((e.clientX - r.left) / r.width, 0, 1) * 360;
    mudou();
  });

  // Teclado: setas movem a bolinha (Shift anda mais rápido)
  area.addEventListener("keydown", function (e) {
    const passo = e.shiftKey ? 0.1 : 0.02;
    if (e.key === "ArrowLeft") s -= passo;
    else if (e.key === "ArrowRight") s += passo;
    else if (e.key === "ArrowUp") v += passo;
    else if (e.key === "ArrowDown") v -= passo;
    else return;
    s = limitarNumero(s, 0, 1);
    v = limitarNumero(v, 0, 1);
    e.preventDefault();
    mudou();
  });

  barra.addEventListener("keydown", function (e) {
    const passo = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") h -= passo;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") h += passo;
    else return;
    h = limitarNumero(h, 0, 360);
    e.preventDefault();
    mudou();
  });

  // Digitar o código: só vale quando está completo e certo
  campoHex.addEventListener("input", function () {
    const novo = hexParaHsv(campoHex.value);
    campoHex.classList.toggle("invalido", !novo && campoHex.value.trim() !== "");
    if (!novo) return;
    // cinza, branco e preto não têm tom: mantém o tom que estava na barra
    h = novo.s === 0 || novo.v === 0 ? h : novo.h;
    s = novo.s;
    v = novo.v;
    desenhar(false);
    if (opcoes.aoMudar) opcoes.aoMudar(hexAtual());
  });

  function fechar() {
    document.removeEventListener("keydown", aoTeclar);
    fundo.remove();
    if (aberto && aberto.focus) aberto.focus({ preventScroll: true });
  }
  function cancelar() {
    fechar();
    if (opcoes.aoCancelar) opcoes.aoCancelar();
  }
  function aoTeclar(e) {
    if (e.key === "Escape") cancelar();
  }
  document.addEventListener("keydown", aoTeclar);

  fundo.querySelector(".sc-cancelar").addEventListener("click", cancelar);
  fundo.querySelector(".sc-definir").addEventListener("click", function () {
    const hex = hexAtual();
    fechar();
    if (opcoes.aoConfirmar) opcoes.aoConfirmar(hex);
  });
  // tocar fora da caixa cancela
  fundo.addEventListener("click", function (e) {
    if (e.target === fundo) cancelar();
  });

  desenhar(true);
  document.body.appendChild(fundo);
  caixa.focus({ preventScroll: true });
}
