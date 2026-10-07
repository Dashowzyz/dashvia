// Aparência: aplica as cores que a pessoa escolheu.
// Este arquivo roda no <head> de cada página, para a cor certa aparecer desde o primeiro instante.
const TEMA_CHAVE = "dashvia:tema";

const CORES_PADRAO = {
  fundo: "#07050f",
  menu: "#3e1785",
  destaque: "#7a4be0",
  texto: "#f2f0f8"
};

const VARIAVEIS_DO_TEMA = [
  "--fundo", "--painel", "--borda", "--menu", "--destaque",
  "--mistura", "--roxo", "--texto", "--texto-suave", "--texto-destaque", "--texto-menu"
];

// ---------- Contas com cores ----------
function hexParaRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbParaHex(rgb) {
  return "#" + rgb.map(function (c) {
    return Math.round(c).toString(16).padStart(2, "0");
  }).join("");
}

// Mistura duas cores (quantidade 0 = só a primeira, 1 = só a segunda)
function misturar(a, b, quantidade) {
  const ca = hexParaRgb(a);
  const cb = hexParaRgb(b);
  return rgbParaHex(ca.map(function (v, i) { return v * (1 - quantidade) + cb[i] * quantidade; }));
}

function luminancia(hex) {
  const canais = hexParaRgb(hex).map(function (v) {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}

// Contraste entre duas cores (de 1 a 21). Para ler bem, o texto precisa de pelo menos 4,5.
function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function ehEscuro(hex) {
  return contraste(hex, "#ffffff") > contraste(hex, "#000000");
}

// ---------- Tema ----------
// Só aceita cores no formato #rrggbb (o que vem do banco nunca vai direto para o CSS)
function limparTema(tema) {
  const limpo = {};
  ["fundo", "menu", "destaque", "texto"].forEach(function (chave) {
    if (tema && typeof tema[chave] === "string" && /^#[0-9a-f]{6}$/i.test(tema[chave])) {
      limpo[chave] = tema[chave].toLowerCase();
    }
  });
  return limpo;
}

// Calcula todas as cores do app a partir das que a pessoa escolheu
function coresEfetivas(temaBruto) {
  const tema = limparTema(temaBruto);
  const fundo = tema.fundo || CORES_PADRAO.fundo;
  const escuro = ehEscuro(fundo);

  // Cartões e bordas acompanham o fundo escolhido
  const painel = tema.fundo
    ? (escuro ? misturar(fundo, "#ffffff", 0.07) : misturar(fundo, "#000000", 0.04))
    : "#120d22";
  const borda = tema.fundo
    ? (escuro ? misturar(fundo, "#ffffff", 0.16) : misturar(fundo, "#000000", 0.12))
    : "#241a3d";

  // Sem letras escolhidas, o app usa claro em fundo escuro e escuro em fundo claro
  const texto = tema.texto || (tema.fundo ? (escuro ? "#f2f0f8" : "#1a1625") : CORES_PADRAO.texto);

  let textoSuave = "#9b94b5";
  if (tema.texto || tema.fundo) {
    textoSuave = texto;
    [0.45, 0.35, 0.25, 0.15].some(function (q) {
      const candidata = misturar(texto, fundo, q);
      if (contraste(candidata, painel) >= 3) {
        textoSuave = candidata;
        return true;
      }
      return false;
    });
  }

  // Botões: versão escura da cor de destaque, sempre com letra branca legível
  const destaque = tema.destaque || CORES_PADRAO.destaque;
  let mistura = "#200d85";
  let hover = "#3e1785";
  if (tema.destaque) {
    mistura = misturar(destaque, "#000000", 0.85);
    [0.45, 0.55, 0.65, 0.75, 0.85].some(function (q) {
      const candidata = misturar(destaque, "#000000", q);
      if (contraste("#ffffff", candidata) >= 4.5) {
        mistura = candidata;
        hover = misturar(destaque, "#000000", Math.max(q - 0.15, 0.2));
        return true;
      }
      return false;
    });
  }

  // Letra que fica em cima da cor de destaque (mês selecionado, botões)
  const textoDestaque = contraste("#ffffff", destaque) >= contraste("#000000", destaque) ? "#ffffff" : "#000000";

  return {
    tema: tema, fundo: fundo, painel: painel, borda: borda,
    menu: tema.menu || CORES_PADRAO.menu,
    destaque: destaque, texto: texto, textoSuave: textoSuave,
    textoDestaque: textoDestaque, mistura: mistura, hover: hover
  };
}

// Limites de legibilidade (quanto menor o número, mais flexível)
const CONTRASTE_TEXTO = 3;       // letras sobre o fundo e os cartões (antes: 4,5)
const CONTRASTE_DESTAQUE = 2;    // cor de destaque sobre o fundo (antes: 3)
const CONTRASTE_MENU = 1.3;      // ícone selecionado sobre a barra do menu (antes: 1,5)

// Impede combinações que deixam o app ilegível
function validarTema(temaBruto) {
  const c = coresEfetivas(temaBruto);

  if (contraste(c.texto, c.fundo) < CONTRASTE_TEXTO || contraste(c.texto, c.painel) < CONTRASTE_TEXTO) {
    return { ok: false, motivo: "As letras ficariam difíceis de ler nesse fundo. Escolha uma cor mais diferente." };
  }
  if (contraste(c.destaque, c.fundo) < CONTRASTE_DESTAQUE) {
    return { ok: false, motivo: "Essa cor de destaque quase some no fundo. Escolha uma mais forte." };
  }
  if (contraste(c.destaque, c.menu) < CONTRASTE_MENU) {
    return { ok: false, motivo: "O ícone selecionado sumiria na barra do menu. Escolha cores mais diferentes." };
  }
  return { ok: true };
}

function aplicarTema(temaBruto) {
  const raiz = document.documentElement;

  VARIAVEIS_DO_TEMA.forEach(function (v) { raiz.style.removeProperty(v); });
  raiz.style.removeProperty("color-scheme");

  const c = coresEfetivas(temaBruto);
  const t = c.tema;

  if (t.fundo) {
    raiz.style.setProperty("--fundo", c.fundo);
    raiz.style.setProperty("--painel", c.painel);
    raiz.style.setProperty("--borda", c.borda);
    raiz.style.colorScheme = ehEscuro(c.fundo) ? "dark" : "light";
  }
  if (t.menu) {
    raiz.style.setProperty("--menu", c.menu);
    // Ícones do menu: branco ou preto, o que ficar mais legível sobre a barra
    raiz.style.setProperty("--texto-menu", contraste("#ffffff", c.menu) >= contraste("#000000", c.menu) ? "#ffffff" : "#000000");
  }
  if (t.destaque) {
    raiz.style.setProperty("--destaque", c.destaque);
    raiz.style.setProperty("--mistura", c.mistura);
    raiz.style.setProperty("--roxo", c.hover);
  }
  if (t.texto || t.fundo) {
    raiz.style.setProperty("--texto", c.texto);
    raiz.style.setProperty("--texto-suave", c.textoSuave);
  }
  raiz.style.setProperty("--texto-destaque", c.textoDestaque);
}

// ---------- Guardar no navegador (a cópia da conta fica no banco) ----------
function temaGuardado() {
  try {
    return limparTema(JSON.parse(localStorage.getItem(TEMA_CHAVE)));
  } catch (erro) {
    return {};
  }
}

function guardarTema(tema) {
  try {
    if (Object.keys(limparTema(tema)).length) {
      localStorage.setItem(TEMA_CHAVE, JSON.stringify(limparTema(tema)));
    } else {
      localStorage.removeItem(TEMA_CHAVE);
    }
  } catch (erro) {
    // sem armazenamento local: o tema continua valendo pela conta
  }
}

aplicarTema(temaGuardado());
