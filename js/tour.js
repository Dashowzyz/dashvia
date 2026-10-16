// Tour guiado: passeia por todas as seções do app, destacando uma coisa por vez.
// Começa pela caixa de boas-vindas (conta nova, uma única vez) ou por "Refazer o tour" em Configurações.
// O passo atual fica guardado neste aparelho, para o tour continuar quando muda de página.
(function () {
  const CHAVE = "dashvia:tour";

  // Para mudar o tour, é só editar os passos abaixo (página, o que destacar, título e texto)
  const PASSOS = [
    {
      pagina: "dashboard.html", alvo: ".menu",
      titulo: "Navegue pelo menu",
      avatar: "pose-01",
      texto: "Por aqui você troca de página: Dashboard, Parcelas futuras, Adicionar gasto, Assinaturas e Configurações."
    },
    {
      pagina: "dashboard.html", alvo: "#link-todos-gastos",
      titulo: "Todos os seus gastos",
      avatar: "pose-09",
      texto: "Aqui você abre a lista com todos os gastos, separados por mês e com busca. Use o lápis para corrigir um gasto e o ✕ para apagar."
    },
    {
      pagina: "dashboard.html", alvo: "#cards",
      avisoExemplo: true, // só neste passo o balão avisa que os valores são de exemplo
      animarValores: true, // os valores em R$ sobem de zero até o total
      revelar: "#cards .card", // os blocos aparecem subindo, um depois do outro
      titulo: "Seus gastos do mês",
      avatar: "pose-07",
      texto: "Estes blocos somam o que você gastou no mês: cartão de crédito, Pix e cada categoria. Para ver outro mês, escolha um dos meses no Resumo, mais abaixo."
    },
    {
      pagina: "dashboard.html", alvo: "#btn-personalizar",
      demo: "personalizar", // mostra, em miniatura, os blocos sendo marcados e desmarcados
      titulo: "Escolha o que ver",
      avatar: "pose-03",
      texto: "Em Personalizar você decide quais blocos aparecem no topo. Pode mudar quando quiser."
    },
    {
      pagina: "dashboard.html", alvo: "#grafico",
      animarValores: true,
      revelar: "#grafico .mes",
      titulo: "Os próximos 12 meses",
      avatar: "pose-02",
      texto: "O Resumo mostra quanto você vai gastar em cada mês, separado por banco e Pix. Boletos e parcelas já entram na conta."
    },
    {
      pagina: "adicionar.html", alvo: ".formulario",
      titulo: "Registre seus gastos",
      avatar: "pose-05",
      texto: "Escolha a categoria primeiro. Boleto e Assinatura têm campos próprios, o Pix não tem parcelas e os boletos residenciais se repetem todo mês. Preenchemos um exemplo para você ver como fica.",
      aoMostrar: preencherExemplo,
      aoSair: limparExemplo
    },
    {
      pagina: "parcelas.html", alvo: "#area-parcelas",
      animarValores: true,
      revelar: ".cartao-banco, .item-parcela",
      titulo: "Parcelas e boletos por banco",
      avatar: "pose-12",
      texto: "Veja o que falta pagar em cada banco, marque parcelas e boletos como pagos e acompanhe os próximos vencimentos."
    },
    {
      pagina: "assinaturas.html", alvo: "#lista-assinaturas",
      animarValores: true,
      revelar: ".assinatura",
      titulo: "Suas assinaturas",
      avatar: "pose-04",
      texto: "Netflix, Spotify e outras cobranças recorrentes ficam aqui, com a próxima cobrança e o gasto em 12 meses."
    },
    {
      pagina: "configuracoes.html", alvo: "#link-espaco",
      titulo: "Divida gastos com outras pessoas",
      avatar: "pose-10",
      texto: "No Espaço compartilhado, até 6 pessoas veem e cuidam juntas dos boletos, assinaturas, mercado e compras da casa. Quem cria o espaço convida os outros por um código, e o histórico mostra quem mudou o quê. Depois de entrar, o seletor no topo das páginas troca entre o lado Pessoal e o do espaço. Seus gastos pessoais continuam só seus."
    },
    {
      pagina: "configuracoes.html", alvo: "#btn-temas",
      titulo: "Deixe com a sua cara",
      avatar: "pose-08",
      texto: "Troque foto, nome, senha e as cores do site. Você também pode escolher um tema pronto."
    },
    {
      pagina: "configuracoes.html", alvo: "#btn-guia",
      titulo: "Precisa de ajuda?",
      avatar: "pose-06",
      texto: "Aqui você revê o guia de uso e refaz este tour quando quiser. Agora é só começar. Boas finanças!"
    }
  ];

  function paginaAtual() {
    // Na Cloudflare as páginas abrem sem o ".html" (/dashboard), então normaliza para o nome do arquivo
    const nome = location.pathname.split("/").pop() || "dashboard";
    return nome.replace(/\.html$/, "") + ".html";
  }

  // Um tour largado no meio não pode voltar horas depois (por exemplo, ao entrar na conta de novo)
  const VALIDADE_MS = 30 * 60 * 1000;

  function lerPasso() {
    try {
      const v = JSON.parse(localStorage.getItem(CHAVE));
      if (!v || typeof v.passo !== "number") return null;
      if (!v.quando || Date.now() - v.quando > VALIDADE_MS) {
        localStorage.removeItem(CHAVE);
        return null;
      }
      return v.passo;
    } catch (falha) {
      return null;
    }
  }

  function gravarPasso(passo) {
    try {
      if (passo === null) localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, JSON.stringify({ passo: passo, pagina: PASSOS[passo] ? PASSOS[passo].pagina : "", quando: Date.now() }));
    } catch (falha) {
      // sem armazenamento local: o tour só não continua depois de trocar de página
    }
  }

  let camadas = null;
  let alvoAtual = null;
  let passoAtual = 0;

  // Durante o tour a pessoa não rola a página: só o próprio tour leva a tela até o alvo
  const TECLAS_DE_ROLAGEM = [" ", "PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"];

  function bloquearRolagem(e) {
    e.preventDefault();
  }

  function bloquearTeclasDeRolagem(e) {
    if (TECLAS_DE_ROLAGEM.indexOf(e.key) !== -1 && !(e.target && e.target.closest && e.target.closest(".tour-balao button") && e.key === " ")) {
      e.preventDefault();
    }
  }

  function travarRolagem() {
    document.addEventListener("wheel", bloquearRolagem, { passive: false, capture: true });
    document.addEventListener("touchmove", bloquearRolagem, { passive: false, capture: true });
    document.addEventListener("keydown", bloquearTeclasDeRolagem, true);
  }

  function destravarRolagem() {
    document.removeEventListener("wheel", bloquearRolagem, { capture: true });
    document.removeEventListener("touchmove", bloquearRolagem, { capture: true });
    document.removeEventListener("keydown", bloquearTeclasDeRolagem, true);
  }

  function limpar() {
    pararDemo();
    destravarRolagem();
    if (camadas) {
      camadas.fundo.remove();
      camadas.destaque.remove();
      camadas.balao.remove();
      camadas = null;
    }
    alvoAtual = null;
    document.removeEventListener("keydown", aoTeclar);
    window.removeEventListener("resize", reposicionar);
    window.removeEventListener("scroll", reposicionar, true);
  }

  // Valores em R$: ficam zerados até chegar a vez da área deles ser destacada; aí sobem até o total.
  // Áreas de passos já vistos mostram o valor final. Vale para textos que são só um valor
  // ("R$ 1.241,35" ou "Total R$ 656,29"). Quem pediu menos movimento no sistema vê tudo direto.
  const FORMATO_MOEDA = { style: "currency", currency: "BRL" };
  const PADRAO_VALOR = /^(Total\s+)?R\$\s*([\d.]+,\d{2})$/;
  const versoesDeValores = {};

  function menosMovimento() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // modo: "zerar" (ainda não é a vez), "animar" (é a vez agora) ou "final" (já passou)
  function controlarValores(indice, modo) {
    const DURACAO = 1500;
    const ATRASO_ENTRE_VALORES = 90;
    const ATRASO_MAXIMO = 900;

    versoesDeValores[indice] = (versoesDeValores[indice] || 0) + 1;
    const minhaVersao = versoesDeValores[indice];
    const seletorAlvo = PASSOS[indice].alvo;
    let tentativas = 0;

    // Os valores são desenhados depois que os dados chegam: espera eles aparecerem
    (function procurar() {
      if (versoesDeValores[indice] !== minhaVersao) return;

      const area = document.querySelector(seletorAlvo);
      const candidatos = area ? Array.from(area.querySelectorAll("*")).filter(function (el) {
        if (el.children.length !== 0) return false;
        const texto = el.dataset.tourFinal !== undefined ? el.dataset.tourFinal : el.textContent;
        return PADRAO_VALOR.test(texto.trim());
      }) : [];

      if (candidatos.length === 0) {
        if (tentativas++ < 60) setTimeout(procurar, 80); // confere logo, para não aparecer o valor final antes de zerar
        return;
      }

      candidatos.forEach(function (el, i) {
        if (el.dataset.tourFinal === undefined) el.dataset.tourFinal = el.textContent; // guarda o texto verdadeiro
        const textoFinal = el.dataset.tourFinal;
        const partes = textoFinal.trim().match(PADRAO_VALOR);
        const prefixo = partes[1] || "";
        const destino = Number(partes[2].replace(/\./g, "").replace(",", "."));
        const zero = prefixo + (0).toLocaleString("pt-BR", FORMATO_MOEDA);

        el._tourVersao = (el._tourVersao || 0) + 1;
        const versaoDoValor = el._tourVersao;

        if (modo === "final" || menosMovimento() || !isFinite(destino) || destino <= 0) {
          el.textContent = textoFinal;
          return;
        }
        if (modo === "zerar") {
          el.textContent = zero;
          return;
        }

        el.textContent = zero;
        const inicio = performance.now() + Math.min(i * ATRASO_ENTRE_VALORES, ATRASO_MAXIMO);

        function passo(agora) {
          if (!el.isConnected || el._tourVersao !== versaoDoValor) return;
          const andamento = Math.min(Math.max((agora - inicio) / DURACAO, 0), 1);
          const suave = 1 - Math.pow(1 - andamento, 3); // começa rápido e vai desacelerando até o valor
          el.textContent = andamento >= 1
            ? textoFinal
            : prefixo + (destino * suave).toLocaleString("pt-BR", FORMATO_MOEDA);
          if (andamento < 1) requestAnimationFrame(passo);
        }
        requestAnimationFrame(passo);
      });
    })();
  }

  // Registros (blocos, linhas do histórico, meses, cartões): somem até chegar a vez da área deles
  // e então aparecem subindo, um depois do outro. O espaço deles continua reservado, para a tela não pular.
  const versoesDeItens = {};

  function controlarItens(indice, modo) {
    const ATRASO_ENTRE_ITENS = 110;
    const ATRASO_MAXIMO = 1000;

    versoesDeItens[indice] = (versoesDeItens[indice] || 0) + 1;
    const minhaVersao = versoesDeItens[indice];
    const seletor = PASSOS[indice].revelar;
    let tentativas = 0;

    (function procurar() {
      if (versoesDeItens[indice] !== minhaVersao) return;

      const itens = Array.from(document.querySelectorAll(seletor));
      if (itens.length === 0) {
        if (tentativas++ < 60) setTimeout(procurar, 80);
        return;
      }

      itens.forEach(function (el, i) {
        el.classList.remove("tour-oculto", "tour-revelar");
        el.style.removeProperty("--tour-atraso");
        if (menosMovimento() || modo === "final") return;

        if (modo === "esconder") {
          el.classList.add("tour-oculto");
          return;
        }

        // "revelar": força o navegador a sair do estado escondido antes de animar
        void el.offsetWidth;
        el.style.setProperty("--tour-atraso", Math.min(i * ATRASO_ENTRE_ITENS, ATRASO_MAXIMO) + "ms");
        el.classList.add("tour-revelar");
        el.addEventListener("animationend", function limpar(e) {
          if (e.target !== el) return;
          el.classList.remove("tour-revelar");
          el.style.removeProperty("--tour-atraso");
          el.removeEventListener("animationend", limpar);
        });
      });
    })();
  }

  // Em cada passo: o que ainda vai ser mostrado fica escondido e zerado; o que já passou aparece inteiro
  function atualizarValoresDaPagina(passoDaVez) {
    PASSOS.forEach(function (p, i) {
      if (p.pagina !== paginaAtual()) return;
      const situacao = i === passoDaVez ? "vez" : i > passoDaVez ? "depois" : "antes";
      if (p.animarValores) controlarValores(i, situacao === "vez" ? "animar" : situacao === "depois" ? "zerar" : "final");
      if (p.revelar) controlarItens(i, situacao === "vez" ? "revelar" : situacao === "depois" ? "esconder" : "final");
    });
  }

  // Ao terminar, devolve os valores verdadeiros (se a página não for recarregada)
  function restaurarValores() {
    Object.keys(versoesDeValores).forEach(function (k) { versoesDeValores[k]++; });
    Object.keys(versoesDeItens).forEach(function (k) { versoesDeItens[k]++; });
    document.querySelectorAll(".tour-oculto, .tour-revelar").forEach(function (el) {
      el.classList.remove("tour-oculto", "tour-revelar");
      el.style.removeProperty("--tour-atraso");
    });
    document.querySelectorAll("[data-tour-final]").forEach(function (el) {
      el._tourVersao = (el._tourVersao || 0) + 1;
      el.textContent = el.dataset.tourFinal;
      delete el.dataset.tourFinal;
    });
  }
  // Demonstração do "Personalizar": a lista de blocos com as caixinhas sendo marcadas e a prévia do topo mudando
  const DEMO_BLOCOS = ["Cartão de crédito", "Pix", "Alimentação", "Compras"];
  // Cada linha é um momento da demonstração (1 = bloco aparece, 0 = escondido)
  const DEMO_ETAPAS = [[1, 1, 1, 1], [1, 0, 1, 1], [1, 0, 0, 1], [1, 1, 0, 1], [1, 1, 1, 1]];
  let temporizadorDemo = null;

  function htmlDaDemo() {
    return '<div class="tour-demo" aria-hidden="true">' +
      '<div class="tour-demo-lista">' +
        DEMO_BLOCOS.map(function (nome) {
          return '<div class="tour-demo-linha"><span class="tour-demo-caixa"></span><span>' + nome + "</span></div>";
        }).join("") +
      "</div>" +
      '<div class="tour-demo-previa">' +
        DEMO_BLOCOS.map(function (nome) {
          return '<span class="tour-demo-bloco">' + nome + "</span>";
        }).join("") +
      "</div>" +
    "</div>";
  }

  function pararDemo() {
    if (temporizadorDemo) clearInterval(temporizadorDemo);
    temporizadorDemo = null;
  }

  function iniciarDemo() {
    pararDemo();
    if (!camadas || menosMovimento()) return;
    const linhas = camadas.balao.querySelectorAll(".tour-demo-linha");
    const blocos = camadas.balao.querySelectorAll(".tour-demo-bloco");
    if (!linhas.length) return;

    function aplicar(etapa) {
      etapa.forEach(function (ligado, i) {
        linhas[i].classList.toggle("marcada", !!ligado);
        blocos[i].classList.toggle("fora", !ligado);
      });
    }

    let indice = 0;
    aplicar(DEMO_ETAPAS[0]);
    temporizadorDemo = setInterval(function () {
      indice = (indice + 1) % DEMO_ETAPAS.length;
      aplicar(DEMO_ETAPAS[indice]);
    }, 1100);
  }

  // No passo de Adicionar gasto: preenche o formulário com uma compra de exemplo (nada é enviado)
  function preencherExemplo() {
    const form = document.getElementById("form-gasto");
    if (!form || typeof atualizarCategoria !== "function") return;

    function definir(id, valor, evento) {
      const campo = document.getElementById(id);
      if (!campo) return;
      campo.value = valor;
      campo.dispatchEvent(new Event(evento || "change", { bubbles: true }));
    }

    const hoje = new Date();
    const dataTexto = hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0") + "-" + String(hoje.getDate()).padStart(2, "0");

    definir("categoria", "Compras");
    definir("plataforma", "Mercado Livre", "input");
    definir("forma", "cartao");
    definir("parcelas", "3");
    definir("data", dataTexto);
    definir("valor", "900.00", "input");
    definir("vencimento", "10");
    if (typeof escolherBanco === "function") escolherBanco("Nubank");
    if (typeof abrirListaBanco === "function") abrirListaBanco(false);
  }

  function limparExemplo() {
    const form = document.getElementById("form-gasto");
    if (!form) return;
    form.reset();
    if (typeof atualizarCategoria === "function") atualizarCategoria();
  }

  // Quando a tela está mostrando gastos de exemplo, o balão avisa
  function atualizarNotaDeExemplo() {
    if (!camadas || !window.dadosDeExemplo || !PASSOS[passoAtual].avisoExemplo) return;
    if (camadas.balao.querySelector(".tour-exemplo")) return;
    const nota = document.createElement("p");
    nota.className = "tour-exemplo";
    nota.textContent = "Os valores desta tela são de exemplo, só para você entender. Seus gastos de verdade aparecem depois do tour.";
    camadas.balao.querySelector(".tour-texto").insertAdjacentElement("afterend", nota);
    reposicionar();
  }

  function sairDoPasso() {
    const p = PASSOS[passoAtual];
    if (p && p.aoSair) p.aoSair();
  }

  function encerrar() {
    sairDoPasso();
    gravarPasso(null);
    limpar();
    restaurarValores();

    // A tela ainda está com os gastos de exemplo: recarrega para mostrar os dados de verdade
    if (window.dadosDeExemplo) location.reload();
  }

  function irPara(passo) {
    if (passo >= PASSOS.length) {
      encerrar();
      return;
    }
    gravarPasso(passo);
    if (PASSOS[passo].pagina !== paginaAtual()) {
      location.href = PASSOS[passo].pagina;
      return;
    }
    mostrar(passo);
  }

  function aoTeclar(e) {
    if (e.key === "Escape") encerrar();
    else if (e.key === "ArrowRight") irPara(passoAtual + 1);
    else if (e.key === "ArrowLeft" && passoAtual > 0) irPara(passoAtual - 1);
  }

  function criarCamadas() {
    const fundo = document.createElement("div");
    fundo.className = "tour-fundo";

    const destaque = document.createElement("div");
    destaque.className = "tour-destaque";

    const balao = document.createElement("div");
    balao.className = "tour-balao";
    balao.setAttribute("role", "dialog");
    balao.setAttribute("aria-live", "polite");

    document.body.appendChild(fundo);
    document.body.appendChild(destaque);
    document.body.appendChild(balao);
    return { fundo: fundo, destaque: destaque, balao: balao };
  }

  // Põe o brilho em volta do alvo e o balão do lado com mais espaço
  function reposicionar() {
    if (!camadas) return;
    const { destaque, balao } = camadas;
    const larguraTela = window.innerWidth;
    const alturaTela = window.innerHeight;
    const margem = 12;
    const larguraBalao = balao.offsetWidth;
    const alturaBalao = balao.offsetHeight;

    if (!alvoAtual) {
      destaque.style.cssText = "left:50%;top:50%;width:0;height:0;";
      balao.style.left = Math.max(margem, (larguraTela - larguraBalao) / 2) + "px";
      balao.style.top = Math.max(margem, (alturaTela - alturaBalao) / 2) + "px";
      return;
    }

    const r = alvoAtual.getBoundingClientRect();
    const folga = 6;
    // O brilho nunca passa da tela, mesmo com alvos grandes
    const esq = Math.max(r.left - folga, 4);
    const topo = Math.max(r.top - folga, 4);
    const dir = Math.min(r.right + folga, larguraTela - 4);
    const base = Math.min(r.bottom + folga, alturaTela - 4);
    destaque.style.left = esq + "px";
    destaque.style.top = topo + "px";
    destaque.style.width = Math.max(dir - esq, 0) + "px";
    destaque.style.height = Math.max(base - topo, 0) + "px";

    // Alvo estreito e alto (o menu lateral do computador): o balão vai para o lado dele
    const espacoDireita = larguraTela - dir;
    if (dir - esq < 140 && base - topo > alturaBalao && espacoDireita >= larguraBalao + 28) {
      balao.style.left = dir + 14 + "px";
      balao.style.top = Math.min(Math.max(topo + 12, margem), alturaTela - alturaBalao - margem) + "px";
      return;
    }

    const espacoAbaixo = alturaTela - base;
    const espacoAcima = topo;
    let topoBalao;
    if (espacoAbaixo >= alturaBalao + 16) topoBalao = base + 12;
    else if (espacoAcima >= alturaBalao + 16) topoBalao = topo - alturaBalao - 12;
    else topoBalao = alturaTela - alturaBalao - margem - (larguraTela <= 700 ? 84 : 0); // alvo enorme: balão fica embaixo da tela

    const centro = (esq + dir) / 2;
    const esqBalao = Math.min(Math.max(centro - larguraBalao / 2, margem), larguraTela - larguraBalao - margem);
    balao.style.left = esqBalao + "px";
    balao.style.top = Math.max(topoBalao, margem) + "px";
  }

  function desenharBalao(passo) {
    const p = PASSOS[passo];
    const ultimo = passo === PASSOS.length - 1;
    const pontos = PASSOS.map(function (_, i) {
      return '<span class="' + (i === passo ? "ativo" : i < passo ? "feito" : "") + '"></span>';
    }).join("");

    camadas.balao.innerHTML =
      '<div class="tour-cabeca">' +
        '<img class="tour-avatar" src="img/avatar/' + p.avatar + '.webp" alt="" width="112" height="93" decoding="async">' +
        "<div>" +
          '<p class="tour-contador">Passo ' + (passo + 1) + " de " + PASSOS.length + "</p>" +
          '<h3 class="tour-titulo"></h3>' +
        "</div>" +
      "</div>" +
      '<p class="tour-texto"></p>' +
      '<div class="tour-pontos">' + pontos + "</div>" +
      '<div class="tour-botoes">' +
        '<button type="button" class="tour-pular">' + (ultimo ? "Fechar" : "Pular tour") + "</button>" +
        '<span class="tour-espaco"></span>' +
        (passo > 0 ? '<button type="button" class="tour-voltar">Voltar</button>' : "") +
        '<button type="button" class="tour-proximo">' + (ultimo ? "Concluir" : "Próximo") + "</button>" +
      "</div>";

    camadas.balao.querySelector(".tour-titulo").textContent = p.titulo;
    // se a imagem do avatar não carregar, o balão segue sem ela
    camadas.balao.querySelector(".tour-avatar").addEventListener("error", function (e) { e.target.remove(); });
    camadas.balao.querySelector(".tour-texto").textContent = p.texto;
    if (p.demo === "personalizar") {
      camadas.balao.querySelector(".tour-texto").insertAdjacentHTML("afterend", htmlDaDemo());
    }
    camadas.balao.querySelector(".tour-pular").addEventListener("click", encerrar);
    camadas.balao.querySelector(".tour-proximo").addEventListener("click", function () { irPara(passo + 1); });
    const voltar = camadas.balao.querySelector(".tour-voltar");
    if (voltar) voltar.addEventListener("click", function () { irPara(passo - 1); });
  }

  // Espera o alvo aparecer (as páginas desenham parte do conteúdo depois de carregar)
  function esperarAlvo(seletor, depois) {
    let tentativas = 0;
    (function procurar() {
      const el = document.querySelector(seletor);
      if (el && el.getBoundingClientRect().height > 0) {
        depois(el);
      } else if (tentativas++ < 25) {
        setTimeout(procurar, 160);
      } else {
        depois(null);
      }
    })();
  }

  function mostrar(passo) {
    limpar();
    passoAtual = passo;
    camadas = criarCamadas();
    desenharBalao(passo);
    document.addEventListener("keydown", aoTeclar);
    window.addEventListener("resize", reposicionar);
    window.addEventListener("scroll", reposicionar, true);
    travarRolagem();

    if (PASSOS[passo].aoMostrar) PASSOS[passo].aoMostrar();
    atualizarValoresDaPagina(passo);
    if (PASSOS[passo].demo === "personalizar") setTimeout(function () { if (camadas && passoAtual === passo) { iniciarDemo(); reposicionar(); } }, 500);

    esperarAlvo(PASSOS[passo].alvo, function (el) {
      if (!camadas || passoAtual !== passo) return;
      // Os dados chegam um pouco depois da página abrir: confere o aviso de exemplo mais de uma vez
      [300, 1000, 2200].forEach(function (ms) { setTimeout(atualizarNotaDeExemplo, ms); });
      alvoAtual = el;
      if (el) {
        // Traz o alvo para a vista; o balão acompanha enquanto a página rola
        el.scrollIntoView({ block: el.getBoundingClientRect().height > window.innerHeight * 0.6 ? "start" : "center", behavior: "smooth" });
      }
      reposicionar();
      setTimeout(reposicionar, 450);
      camadas.balao.querySelector(".tour-proximo").focus({ preventScroll: true });
    });
  }

  // Usado pela caixa de boas-vindas e por "Refazer o tour" em Configurações
  window.iniciarTour = function () {
    // Recarrega a página do primeiro passo, para ela já desenhar os dados de exemplo
    gravarPasso(0);
    location.href = PASSOS[0].pagina;
  };

  // Se o tour estava em andamento e esta é a página do passo, continua. Se a pessoa saiu do roteiro, cancela.
  const guardado = lerPasso();
  if (guardado !== null && PASSOS[guardado]) {
    if (PASSOS[guardado].pagina === paginaAtual()) mostrar(guardado);
    else gravarPasso(null);
  }
})();