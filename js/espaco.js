// Espaço compartilhado: criar, entrar com código, ver os membros e o histórico (últimos 30 dias)
const area = document.getElementById("area-espaco");
const resumo = document.getElementById("resumo-espaco");

let espaco = null;
let membros = [];
let abaAtual = "membros";

// ---------- Ajudantes ----------
function criar(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
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

function avatar(pessoa) {
  const a = criar("div", "esp-avatar", (pessoa.nome || "?").trim().charAt(0).toUpperCase() || "?");
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

// ---------- Sem espaço: criar ou entrar ----------
function mostrarSemEspaco() {
  resumo.textContent = "Gastos que você divide com outras pessoas";
  area.textContent = "";

  const intro = criar("p", "esp-intro",
    "Crie um espaço e convide até " + (MAXIMO_MEMBROS - 1) + " pessoas para dividir boletos, assinaturas e compras de mercado. Seus gastos pessoais continuam só seus.");

  // Criar
  const cartaoCriar = criar("div", "bloco esp-cartao");
  cartaoCriar.append(criar("h2", "", "Criar um espaço"));
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
  cartaoEntrar.append(criar("h2", "", "Entrar com um código"));
  const codigo = campo("Código de convite", "esp-codigo", { maxLength: 12, placeholder: "Ex: K7M2QX9P" });
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

  area.append(intro, cartaoCriar, cartaoEntrar);
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

  const topo = criar("div", "bloco esp-topo");
  const info = criar("div");
  info.append(
    criar("h2", "", espaco.nome),
    criar("p", "esp-sub", (espaco.souLider ? "Você é o líder" : "Você é membro") + " · " + membros.length + " de " + MAXIMO_MEMBROS + " pessoas")
  );
  topo.append(info);
  area.append(topo);

  const abas = criar("div", "esp-abas");
  abas.setAttribute("role", "tablist");
  [["membros", "Membros"], ["historico", "Histórico"]].forEach(function (a) {
    const b = botao(a[1], "esp-aba" + (abaAtual === a[0] ? " ativa" : ""), function () {
      abaAtual = a[0];
      mostrarEspaco();
    });
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(abaAtual === a[0]));
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
    li.append(avatar(m));

    const nomes = criar("div", "esp-membro-nome");
    nomes.append(criar("strong", "", m.nome || "Sem nome" ));
    if (eu) nomes.append(criar("small", "", "você"));
    li.append(nomes);

    if (m.lider) li.append(criar("span", "esp-selo", "Líder"));

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
  painel.append(lista);

  // Convite (só o líder)
  if (espaco.souLider) {
    const cheio = membros.length >= MAXIMO_MEMBROS;
    const convite = criar("div", "bloco esp-cartao");
    convite.append(criar("h2", "", "Convidar alguém"));
    convite.append(criar("p", "esp-sub", cheio
      ? "O espaço está cheio (" + MAXIMO_MEMBROS + " pessoas). Remova alguém para convidar outra pessoa."
      : "Gere um código e mande para a pessoa. Ela entra em Configurações → Espaço compartilhado → Entrar com um código."));

    const resultado = criar("div", "esp-codigo-resultado");
    const gerar = botao("Gerar código de convite", "esp-botao", async function () {
      gerar.disabled = true;
      const { data, error } = await gerarConvite();
      gerar.disabled = false;
      resultado.textContent = "";
      if (error) { resultado.append(criar("p", "esp-aviso", textoDoErroEspaco(error))); return; }

      const caixa = criar("div", "esp-codigo-caixa");
      caixa.append(criar("strong", "", data));
      caixa.append(botao("Copiar", "esp-link", async function () {
        try {
          await navigator.clipboard.writeText(data);
          this.textContent = "Copiado!";
        } catch (falha) {
          this.textContent = "Copie à mão";
        }
      }));
      resultado.append(caixa, criar("small", "esp-sub", "Vale por 7 dias e serve para uma pessoa só."));
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

async function mostrarHistorico(painel) {
  let linhas;
  try {
    linhas = await buscarHistoricoDoEspaco();
  } catch (falha) {
    console.error(falha);
    painel.append(criar("p", "vazio", "Não foi possível carregar o histórico. Atualize a página."));
    return;
  }

  painel.append(criar("p", "esp-sub esp-nota", "Mostra o que aconteceu nos últimos 30 dias. Depois disso o registro é apagado sozinho."));

  if (linhas.length === 0) {
    painel.append(criar("p", "vazio", "Nada aconteceu nos gastos do espaço ainda."));
    return;
  }

  const lista = criar("ul", "bloco esp-historico");
  linhas.forEach(function (h) {
    const li = criar("li", "esp-hist-item " + h.acao);
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
