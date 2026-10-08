// Espaço compartilhado: criar, entrar com código, ver os membros e o histórico (últimos 30 dias)
const area = document.getElementById("area-espaco");
const resumo = document.getElementById("resumo-espaco");

let espaco = null;
let membros = [];
let abaAtual = "membros";

// ---------- Ícones ----------
const ICONES = {
  pessoas: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  coroa: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
  mais: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  lapis: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  lixeira: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  certo: '<polyline points="20 6 9 17 4 12"/>',
  copiar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  enviar: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  chave: '<path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  maisPessoa: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>',
  relogio: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'
};

function icone(nome, tamanho) {
  const t = tamanho || 18;
  return '<svg viewBox="0 0 24 24" width="' + t + '" height="' + t + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONES[nome] + "</svg>";
}

// ---------- Ajudantes ----------
function criar(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function comIcone(tag, classe, nomeIcone, texto, tamanho) {
  const e = criar(tag, classe);
  e.innerHTML = icone(nomeIcone, tamanho);
  if (texto) e.append(document.createTextNode(texto));
  return e;
}

function botao(texto, classe, aoClicar) {
  const b = criar("button", classe, texto);
  b.type = "button";
  b.addEventListener("click", aoClicar);
  return b;
}

function moeda(numero) {
  return Number(numero).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function tempoAtras(texto) {
  const data = new Date(texto);
  const minutos = Math.max(0, Math.round((Date.now() - data.getTime()) / 60000));
  if (minutos < 1) return "agora";
  if (minutos < 60) return "há " + minutos + " min";
  const horas = Math.round(minutos / 60);
  if (horas < 24) return "há " + horas + " h";
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " às " +
    data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function avatar(pessoa, classeExtra) {
  const a = criar("div", "esp-avatar" + (classeExtra ? " " + classeExtra : ""), (pessoa.nome || "?").trim().charAt(0).toUpperCase() || "?");
  if (pessoa.foto) {
    a.textContent = "";
    a.style.backgroundImage = 'url("' + String(pessoa.foto).replace(/"/g, "%22") + '")';
  }
  return a;
}

// Campo de texto com rótulo, dentro de um cartão
function campo(rotulo, id, opcoes) {
  const grupo = criar("div", "esp-campo");
  const l = criar("label", "", rotulo);
  l.htmlFor = id;
  const i = criar("input");
  i.id = id;
  i.type = "text";
  i.autocomplete = "off";
  Object.assign(i, opcoes || {});
  grupo.append(l, i);
  return { grupo: grupo, input: i };
}

function aviso(caixa, texto, ok) {
  caixa.textContent = texto;
  caixa.className = "esp-aviso" + (ok ? " ok" : "");
}

// Título de um cartão: bolinha com ícone + texto
function cabecalhoCartao(nomeIcone, titulo, subtitulo) {
  const cab = criar("div", "esp-cab");
  cab.append(comIcone("span", "esp-cab-icone", nomeIcone, "", 20));
  const textos = criar("div");
  textos.append(criar("h2", "", titulo));
  if (subtitulo) textos.append(criar("p", "esp-sub", subtitulo));
  cab.append(textos);
  return cab;
}

// ---------- Sem espaço: criar ou entrar ----------
function mostrarSemEspaco() {
  resumo.textContent = "Gastos que você divide com outras pessoas";
  area.textContent = "";

  const hero = criar("div", "bloco esp-hero esp-hero-vazio");
  hero.append(comIcone("div", "esp-hero-icone grande", "pessoas", "", 34));
  hero.append(criar("h2", "", "Divida os gastos com quem mora com você"));
  hero.append(criar("p", "esp-sub", "Boletos, assinaturas e compras de mercado ficam num lugar só, para todo mundo ver e marcar como pago. Seus gastos pessoais continuam só seus."));

  const passos = criar("ol", "esp-passos");
  ["Crie o espaço e dê um nome", "Gere um código e mande no WhatsApp", "Até " + MAXIMO_MEMBROS + " pessoas dividem tudo"].forEach(function (texto, i) {
    const li = criar("li");
    li.append(criar("span", "", String(i + 1)), document.createTextNode(texto));
    passos.append(li);
  });
  hero.append(passos);

  // Criar
  const cartaoCriar = criar("div", "bloco esp-cartao");
  cartaoCriar.append(cabecalhoCartao("mais", "Criar um espaço", "Você vira o líder."));
  const nome = campo("Nome do espaço", "esp-nome", { maxLength: 30, placeholder: "Ex: Casa" });
  const avisoCriar = criar("p", "esp-aviso");
  const btnCriar = botao("Criar espaço", "esp-botao", async function () {
    const texto = nome.input.value.trim();
    if (texto.length < 2) { aviso(avisoCriar, "Use um nome de 2 a 30 letras."); return; }
    btnCriar.disabled = true;
    const { error } = await criarEspaco(texto);
    btnCriar.disabled = false;
    if (error) { aviso(avisoCriar, textoDoErroEspaco(error)); return; }
    iniciar();
  });
  cartaoCriar.append(nome.grupo, avisoCriar, btnCriar);

  // Entrar com código
  const cartaoEntrar = criar("div", "bloco esp-cartao");
  cartaoEntrar.append(cabecalhoCartao("chave", "Entrar com um código", "Peça o código ao líder do espaço."));
  const codigo = campo("Código de convite", "esp-codigo", { maxLength: 12, placeholder: "Ex: K7M2QX9P" });
  codigo.input.classList.add("esp-input-codigo");
  codigo.input.addEventListener("input", function () {
    codigo.input.value = codigo.input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  });
  const avisoEntrar = criar("p", "esp-aviso");
  const btnEntrar = botao("Entrar no espaço", "esp-botao", async function () {
    const texto = codigo.input.value.trim();
    if (texto.length < 4) { aviso(avisoEntrar, "Digite o código que o líder te enviou."); return; }
    btnEntrar.disabled = true;
    const { error } = await entrarComCodigo(texto);
    btnEntrar.disabled = false;
    if (error) { aviso(avisoEntrar, textoDoErroEspaco(error)); return; }
    iniciar();
  });
  cartaoEntrar.append(codigo.grupo, avisoEntrar, btnEntrar);

  area.append(hero, cartaoCriar, cartaoEntrar);
}

// ---------- Com espaço ----------
async function mostrarEspaco() {
  try {
    membros = await listarMembros();
  } catch (falha) {
    console.error(falha);
    area.textContent = "";
    area.append(criar("p", "vazio", "Não foi possível carregar o espaço. Atualize a página."));
    return;
  }

  resumo.textContent = "Gastos que você divide com outras pessoas";
  area.textContent = "";

  // Cartão do espaço: nome, papel e as vagas (cheias e livres)
  const hero = criar("div", "bloco esp-hero");
  const linha = criar("div", "esp-hero-linha");
  linha.append(comIcone("div", "esp-hero-icone", "pessoas", "", 28));

  const info = criar("div", "esp-hero-info");
  info.append(criar("h2", "", espaco.nome));
  info.append(espaco.souLider
    ? comIcone("span", "esp-papel lider", "coroa", "Você é o líder", 14)
    : comIcone("span", "esp-papel", "pessoas", "Você é membro", 14));
  linha.append(info);
  hero.append(linha);

  const vagas = criar("div", "esp-vagas");
  const fila = criar("div", "esp-vagas-fila");
  for (let i = 0; i < MAXIMO_MEMBROS; i++) {
    if (membros[i]) fila.append(avatar(membros[i], "pequeno"));
    else fila.append(criar("div", "esp-avatar pequeno vazio"));
  }
  vagas.append(fila, criar("span", "esp-vagas-texto", membros.length + " de " + MAXIMO_MEMBROS + " pessoas"));
  hero.append(vagas);
  area.append(hero);

  const abas = criar("div", "esp-abas");
  abas.setAttribute("role", "tablist");
  [["membros", "Membros", "pessoas"], ["historico", "Histórico", "relogio"]].forEach(function (a) {
    const b = comIcone("button", "esp-aba" + (abaAtual === a[0] ? " ativa" : ""), a[2], a[1], 16);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(abaAtual === a[0]));
    b.addEventListener("click", function () {
      abaAtual = a[0];
      mostrarEspaco();
    });
    abas.append(b);
  });
  area.append(abas);

  const painel = criar("div", "esp-painel");
  area.append(painel);

  if (abaAtual === "historico") await mostrarHistorico(painel);
  else mostrarMembros(painel);
}

function mostrarMembros(painel) {
  const lista = criar("ul", "bloco esp-membros");

  membros.forEach(function (m) {
    const eu = m.id === espaco.meuId;
    const li = criar("li", "esp-membro");

    const caixaAvatar = criar("div", "esp-avatar-caixa");
    caixaAvatar.append(avatar(m, m.lider ? "lider" : ""));
    if (m.lider) caixaAvatar.append(comIcone("span", "esp-coroa", "coroa", "", 12));
    li.append(caixaAvatar);

    const nomes = criar("div", "esp-membro-nome");
    nomes.append(criar("strong", "", m.nome || "Sem nome"));
    nomes.append(criar("small", "", m.lider ? "Líder" + (eu ? " · você" : "") : (eu ? "Você" : "Membro")));
    li.append(nomes);

    if (espaco.souLider && !eu) {
      const acoes = criar("div", "esp-acoes");
      acoes.append(
        botao("Passar liderança", "esp-link", async function () {
          if (!await confirmar("Passar a liderança para " + m.nome + "? Você vira um membro comum.", "Passar liderança")) return;
          const { error } = await passarLideranca(m.id);
          if (error) { alert(textoDoErroEspaco(error)); return; }
          iniciar();
        }),
        botao("Remover", "esp-link perigo", async function () {
          if (!await confirmar("Remover " + m.nome + " do espaço? Os gastos que a pessoa lançou continuam no espaço.", "Remover")) return;
          const { error } = await removerMembro(m.id);
          if (error) { alert(textoDoErroEspaco(error)); return; }
          iniciar();
        })
      );
      li.append(acoes);
    }
    lista.append(li);
  });

  // Vagas livres (só para dar uma ideia de quantas ainda cabem)
  for (let i = membros.length; i < MAXIMO_MEMBROS; i++) {
    const vaga = criar("li", "esp-membro esp-vaga");
    vaga.append(comIcone("div", "esp-vaga-icone", "maisPessoa", "", 18));
    vaga.append(criar("span", "", "Vaga livre"));
    lista.append(vaga);
  }
  painel.append(lista);

  // Convite (só o líder)
  if (espaco.souLider) {
    const cheio = membros.length >= MAXIMO_MEMBROS;
    const convite = criar("div", "bloco esp-cartao esp-convite");
    convite.append(cabecalhoCartao("chave", "Convidar alguém", cheio
      ? "O espaço está cheio. Remova alguém para convidar outra pessoa."
      : "Gere um código e mande para a pessoa. Cada código vale para uma pessoa."));

    const resultado = criar("div", "esp-codigo-resultado");
    const gerar = botao(cheio ? "Espaço cheio" : "Gerar código de convite", "esp-botao", async function () {
      gerar.disabled = true;
      const { data, error } = await gerarConvite();
      gerar.disabled = false;
      resultado.textContent = "";
      if (error) { resultado.append(criar("p", "esp-aviso", textoDoErroEspaco(error))); return; }

      const blocos = criar("div", "esp-codigo-blocos");
      String(data).split("").forEach(function (letra) { blocos.append(criar("span", "", letra)); });

      const acoes = criar("div", "esp-codigo-acoes");
      const copiar = comIcone("button", "esp-botao-sec", "copiar", "Copiar", 16);
      copiar.type = "button";
      copiar.addEventListener("click", async function () {
        try {
          await navigator.clipboard.writeText(data);
          copiar.innerHTML = icone("certo", 16) + "Copiado!";
        } catch (falha) {
          copiar.textContent = "Copie à mão";
        }
      });
      acoes.append(copiar);

      if (navigator.share) {
        const enviar = comIcone("button", "esp-botao-sec", "enviar", "Enviar", 16);
        enviar.type = "button";
        enviar.addEventListener("click", function () {
          navigator.share({
            title: "Dashvia",
            text: "Entre no espaço \"" + espaco.nome + "\" no Dashvia. Em Configurações → Espaço compartilhado → Entrar com um código, use: " + data
          }).catch(function () { /* a pessoa cancelou */ });
        });
        acoes.append(enviar);
      }

      resultado.append(blocos, acoes, comIcone("small", "esp-validade", "relogio", "Vale por 7 dias e serve para uma pessoa só.", 13));
    });
    gerar.disabled = cheio;
    convite.append(gerar, resultado);
    painel.append(convite);
  }

  // Sair ou excluir
  const rodape = criar("div", "esp-rodape");
  if (espaco.souLider && membros.length > 1) {
    rodape.append(criar("p", "esp-sub", "Para sair, passe a liderança para outra pessoa."));
  } else if (espaco.souLider) {
    rodape.append(botao("Excluir espaço", "esp-link perigo", async function () {
      if (!await confirmar("Excluir o espaço " + espaco.nome + "? Todos os gastos dele e o histórico serão apagados. Isso não pode ser desfeito.", "Excluir espaço")) return;
      const { error } = await excluirEspaco();
      if (error) { alert(textoDoErroEspaco(error)); return; }
      iniciar();
    }));
  } else {
    rodape.append(botao("Sair do espaço", "esp-link perigo", async function () {
      if (!await confirmar("Sair do espaço " + espaco.nome + "? Os gastos que você lançou continuam lá para os outros.", "Sair")) return;
      const { error } = await sairDoEspaco();
      if (error) { alert(textoDoErroEspaco(error)); return; }
      iniciar();
    }));
  }
  painel.append(rodape);
}

const VERBOS = {
  adicionou: "adicionou",
  editou: "editou",
  apagou: "apagou",
  pagamento: "registrou pagamento em"
};

const ICONE_DA_ACAO = { adicionou: "mais", editou: "lapis", apagou: "lixeira", pagamento: "certo" };

async function mostrarHistorico(painel) {
  let linhas;
  try {
    linhas = await buscarHistoricoDoEspaco();
  } catch (falha) {
    console.error(falha);
    painel.append(criar("p", "vazio", "Não foi possível carregar o histórico. Atualize a página."));
    return;
  }

  painel.append(comIcone("p", "esp-nota", "relogio", "Mostra os últimos 30 dias. Depois disso, o registro é apagado sozinho.", 14));

  if (linhas.length === 0) {
    const vazio = criar("div", "bloco esp-vazio");
    vazio.append(comIcone("div", "esp-hero-icone", "relogio", "", 26));
    vazio.append(criar("p", "", "Nada aconteceu nos gastos do espaço ainda. Quando alguém adicionar, editar, pagar ou apagar um gasto, aparece aqui."));
    painel.append(vazio);
    return;
  }

  const lista = criar("ul", "bloco esp-historico");
  linhas.forEach(function (h) {
    const li = criar("li", "esp-hist-item " + h.acao);
    li.append(comIcone("span", "esp-hist-icone", ICONE_DA_ACAO[h.acao] || "lapis", "", 16));

    const texto = criar("div", "esp-hist-texto");
    const frase = criar("p");
    frase.append(
      criar("strong", "", h.nome_pessoa || "Alguém"),
      document.createTextNode(" " + (VERBOS[h.acao] || h.acao) + " "),
      criar("strong", "", h.plataforma || "um gasto")
    );
    texto.append(frase);
    texto.append(criar("small", "", [h.categoria, h.valor != null ? moeda(h.valor) : "", tempoAtras(h.quando)].filter(Boolean).join(" · ")));

    li.append(texto);
    lista.append(li);
  });
  painel.append(lista);
}

// ---------- Início ----------
async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  esquecerEspaco();
  espaco = await meuEspaco();

  if (!espaco) {
    abaAtual = "membros";
    mostrarSemEspaco();
  } else {
    await mostrarEspaco();
  }
}

iniciar();
