// Conexão com o Supabase (banco de dados + login)
// O arquivo supabase.bundle.js (gerado por "npm run build" na pasta ferramentas) cria window.dashviaDb.
// Quem protege os dados são as regras do banco (Row Level Security), não este arquivo.
const db = window.dashviaDb;

// ---------- Senha ----------
// O Dashvia pede 6 números. O PIN ganha um sufixo fixo antes de ir para o login, para a senha
// ficar mais longa que 6 caracteres. A tela continua com 6 números.
// ATENÇÃO: não mude este sufixo depois de ter usuários, ou ninguém consegue mais entrar.
const SUFIXO_SENHA = "-dashvia";

function senhaDoPin(pin) {
  return pin + SUFIXO_SENHA;
}

// Traduz os erros do login do Supabase para tipos simples que as páginas entendem
function tipoDoErro(erro) {
  const codigo = String((erro && (erro.code || erro.error_code)) || "").toLowerCase();
  const msg = String((erro && erro.message) || "").toLowerCase();

  if (codigo === "email_not_confirmed" || msg.includes("not confirmed")) return "nao_confirmado";
  if (codigo === "invalid_credentials" || msg.includes("invalid login credentials")) return "credenciais";
  if (codigo === "user_already_exists" || codigo === "email_exists" || msg.includes("already registered")) return "ja_cadastrado";
  if ((erro && erro.status === 429) || codigo.startsWith("over_") || msg.includes("rate limit")) return "muitas_tentativas";
  if (codigo === "otp_expired" || codigo === "bad_jwt" || msg.includes("expired") || msg.includes("invalid token")) return "link_invalido";
  return "outro";
}

// Todas as funções abaixo devolvem { error: null } ou { error: { tipo, original } }
function resultado(resposta) {
  if (resposta && resposta.error) {
    return { error: { tipo: tipoDoErro(resposta.error), original: resposta.error }, data: null };
  }
  return { error: null, data: resposta ? resposta.data : null };
}

// ---------- Login ----------
// A sessão é consultada uma vez por página: as várias chamadas seguintes reaproveitam a resposta
let sessaoEmAndamento = null;

async function usuarioAtual() {
  if (!sessaoEmAndamento) {
    sessaoEmAndamento = db.auth.getSession().then(function (resposta) {
      const dados = resposta && resposta.data;
      const usuario = (dados && dados.session && dados.session.user) || null;
      // Só guarda quando há login: quem ainda vai entrar precisa de uma resposta nova
      if (!usuario) sessaoEmAndamento = null;
      return usuario;
    }, function (falha) {
      sessaoEmAndamento = null;
      throw falha;
    });
  }
  return sessaoEmAndamento;
}

// Páginas internas: se não tiver login, volta para a tela de entrada
async function exigirLogin() {
  const usuario = await usuarioAtual();
  if (!usuario) {
    window.location.href = "login.html";
    return null;
  }
  return usuario;
}

// O tour é por sessão: ao entrar ou sair da conta, qualquer tour largado no meio é esquecido
function esquecerTour() {
  try {
    localStorage.removeItem("dashvia:tour");
  } catch (falha) {
    // sem armazenamento local: tudo bem
  }
}

async function entrar(email, pin) {
  esquecerTour();
  return resultado(await db.auth.signInWithPassword({ email: email, password: senhaDoPin(pin) }));
}

async function sair() {
  esquecerTour();
  sessaoEmAndamento = null;
  try {
    await db.auth.signOut();
  } catch (falha) {
    console.error(falha);
  }
  sessionStorage.clear();
  window.location.href = "login.html";
}

// O "usuário" (apelido) só pode ir para o perfil depois do primeiro login.
// Se a conta exigir confirmação de e-mail, ele fica guardado aqui até lá.
function chavePendente(email) {
  return "dashvia:pendente:" + String(email).toLowerCase();
}

async function cadastrar(nome, usuario, email, pin) {
  const criada = resultado(await db.auth.signUp({
    email: email,
    password: senhaDoPin(pin),
    options: { data: { name: nome } }
  }));
  if (criada.error) return criada;

  // Com confirmação de e-mail ligada, o Supabase não dá erro para um e-mail que já existe:
  // devolve um usuário "vazio" (sem identidades). É assim que dá para perceber.
  const novo = criada.data && criada.data.user;
  if (novo && Array.isArray(novo.identities) && novo.identities.length === 0) {
    return { error: { tipo: "ja_cadastrado", original: null }, data: null };
  }

  try {
    localStorage.setItem(chavePendente(email), JSON.stringify({ nome: nome, usuario: usuario }));
  } catch (falha) {
    // sem armazenamento local: o apelido fica vazio, e dá para preencher depois
  }

  // Tenta entrar já. Se a conta exigir confirmação de e-mail, avisa a página.
  const entrada = await entrar(email, pin);
  if (entrada.error) {
    return { error: null, data: null, precisaConfirmar: entrada.error.tipo === "nao_confirmado" };
  }
  return { error: null, data: null, precisaConfirmar: false };
}

async function pedirRecuperacao(email, enderecoDaPagina) {
  return resultado(await db.auth.resetPasswordForEmail(email, { redirectTo: enderecoDaPagina }));
}

// O link do e-mail abre a página de redefinição já com uma sessão temporária de recuperação.
// Por isso basta gravar a senha nova para quem está nela.
async function redefinirSenha(pin) {
  const resposta = resultado(await db.auth.updateUser({ password: senhaDoPin(pin) }));
  if (resposta.error) return resposta;
  // Encerra a sessão temporária: a pessoa entra de novo com a senha nova
  try {
    await db.auth.signOut();
  } catch (falha) {
    console.error(falha);
  }
  return resposta;
}

// O Supabase não confere a senha atual sozinho: entra de novo com ela antes de trocar
async function alterarSenha(pinAtual, pinNovo) {
  const usuario = await usuarioAtual();
  if (!usuario) return { error: { tipo: "outro", original: null }, data: null };

  const conferencia = resultado(await db.auth.signInWithPassword({ email: usuario.email, password: senhaDoPin(pinAtual) }));
  if (conferencia.error) return conferencia;

  return resultado(await db.auth.updateUser({ password: senhaDoPin(pinNovo) }));
}

async function alterarEmail(novoEmail) {
  try {
    return resultado(await db.auth.updateUser(
      { email: novoEmail },
      { emailRedirectTo: new URL("login.html", window.location.href).href }
    ));
  } catch (falha) {
    return resultado({ error: falha });
  }
}

// Apaga a conta (e, em cascata, o perfil e os gastos). Confere a senha antes.
async function excluirConta(email, pin) {
  const conferencia = await entrar(email, pin);
  if (conferencia.error) return conferencia;

  const resposta = await db.rpc("excluir_minha_conta");
  if (resposta.error) {
    // quem lidera um espaço com outras pessoas precisa passar a liderança antes
    const tipo = String(resposta.error.message || "").includes("PASSE_LIDERANCA") ? "lider" : "outro";
    return { error: { tipo: tipo, original: resposta.error }, data: null };
  }

  try {
    await db.auth.signOut();
  } catch (falha) {
    // a conta já não existe; a sessão local é limpa abaixo
  }
  sessionStorage.clear();
  return { error: null, data: null };
}

// ---------- Gastos ----------
// Converte uma linha do banco para o formato que o site já usa
function doBanco(linha, nomes) {
  return {
    id: linha.id,
    espacoId: linha.espaco_id || null, // vazio = gasto individual
    criadoEm: linha.criado_em || null, // quando foi lançado
    autorId: linha.user_id || null,
    autorNome: (nomes && linha.user_id && nomes[linha.user_id]) || "",
    plataforma: linha.plataforma,
    categoria: linha.categoria,
    parcelas: linha.parcelas,
    data: linha.data,
    valor: Number(linha.valor),
    vencimento: linha.vencimento,
    banco: linha.banco,
    canceladoEm: linha.cancelado_em,
    pagasAte: linha.pagas_ate || 0, // número da última parcela que a pessoa marcou como paga, contando do começo
    pagasFim: linha.pagas_fim || 0 // quantas parcelas ela pagou "de trás pra frente", contando do fim
  };
}

function paraBanco(campos) {
  const linha = {};
  ["plataforma", "categoria", "parcelas", "data", "valor", "vencimento", "banco"].forEach(function (chave) {
    if (campos[chave] !== undefined) linha[chave] = campos[chave];
  });
  if (campos.canceladoEm !== undefined) linha.cancelado_em = campos.canceladoEm;
  if (campos.pagasAte !== undefined) linha.pagas_ate = campos.pagasAte;
  if (campos.pagasFim !== undefined) linha.pagas_fim = campos.pagasFim;
  return linha;
}

// Durante o tour guiado, quem ainda não tem gastos vê gastos de exemplo (só na tela; nada é salvo no banco)
function tourDeExemploAtivo() {
  try {
    const v = JSON.parse(localStorage.getItem("dashvia:tour"));
    const paginaAgora = (location.pathname.split("/").pop() || "dashboard").replace(/\.html$/, "") + ".html";
    return !!v && typeof v.passo === "number" && v.pagina === paginaAgora && !!v.quando && Date.now() - v.quando <= 30 * 60 * 1000;
  } catch (falha) {
    return false;
  }
}

function gastosDeExemplo() {
  const agora = new Date();
  function texto(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function diaDoMes(dia) {
    return texto(new Date(agora.getFullYear(), agora.getMonth(), dia));
  }
  function emDias(n) {
    return texto(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + n));
  }
  function gasto(id, plataforma, categoria, parcelas, data, valor, vencimento, banco) {
    return { id: -id, plataforma: plataforma, categoria: categoria, parcelas: parcelas, data: data, valor: valor, vencimento: vencimento, banco: banco, canceladoEm: null, pagasAte: 0, pagasFim: 0 };
  }

  window.dadosDeExemplo = true;
  return [
    gasto(1, "Mercado Livre", "Compras", "3", diaDoMes(1), 900, 10, "Nubank"),
    gasto(2, "Magalu", "Compras", "6", diaDoMes(1), 1200, 20, "Inter"),
    gasto(3, "iFood", "Alimentação", "pix", diaDoMes(2), 58.9, null, "Nubank"),
    gasto(4, "Uber", "Transportes", "avista", diaDoMes(2), 32.5, null, "Nubank"),
    gasto(5, "Netflix", "Assinatura", "mensal", diaDoMes(1), 55.9, null, "Nubank"),
    gasto(6, "Spotify", "Assinatura", "mensal", diaDoMes(1), 21.9, null, "Inter"),
    gasto(7, "Conta de luz", "Boleto", "mensal", emDias(5), 182.4, null, "Boleto"),
    gasto(8, "Condomínio", "Boleto", "mensal", emDias(14), 450, null, "Boleto"),
    gasto(9, "Geladeira", "Boleto", "5", diaDoMes(1), 2500, 15, "Boleto")
  ];
}

// Devolve os gastos do lado escolhido: os individuais ("Pessoal") ou os do espaço compartilhado
async function buscarGastos() {
  const espaco = await escopoAtual();

  let consulta = db.from("gastos").select("*").order("id", { ascending: true });
  consulta = espaco ? consulta.eq("espaco_id", espaco.id) : consulta.is("espaco_id", null);

  const resultado = await Promise.all([consulta, espaco ? nomesDoEspaco() : null]);
  const { data, error } = resultado[0];
  if (error) throw error;
  if (data.length === 0 && tourDeExemploAtivo()) return gastosDeExemplo();
  return data.map(function (linha) { return doBanco(linha, resultado[1]); });
}

// Nomes das categorias já usadas nos gastos individuais da pessoa (para montar a lista, com as que ela criou)
async function buscarCategoriasUsadas() {
  const { data, error } = await db.from("gastos").select("categoria").is("espaco_id", null);
  if (error) throw error;
  return Array.from(new Set(data.map(function (linha) { return linha.categoria; })));
}

async function adicionarGasto(gasto) {
  const espaco = await escopoAtual();
  const linha = paraBanco(gasto);
  if (espaco) linha.espaco_id = espaco.id;

  const { data, error } = await db.from("gastos").insert(linha).select().single();
  if (error) throw error;
  return doBanco(data);
}

async function atualizarGasto(id, campos) {
  const { error } = await db.from("gastos").update(paraBanco(campos)).eq("id", id);
  if (error) throw error;
}

async function removerGasto(id) {
  const { error } = await db.from("gastos").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Perfil (nome, apelido, foto, cores) ----------
// Fica guardado na sessão para não buscar de novo a cada página
async function buscarPerfil(forcar) {
  const usuario = await usuarioAtual();
  if (!usuario) return null;

  const chave = "perfil:" + usuario.id;
  if (!forcar) {
    const guardado = sessionStorage.getItem(chave);
    if (guardado) return JSON.parse(guardado);
  }

  const { data, error } = await db
    .from("perfis")
    .select("nome, usuario, foto, tema, banco_favorito")
    .eq("id", usuario.id)
    .maybeSingle();
  if (error) throw error;

  let linha = data;

  // O perfil é criado no primeiro acesso (não há gatilho no banco para isso).
  if (!linha) {
    let pendente = {};
    try {
      pendente = JSON.parse(localStorage.getItem(chavePendente(usuario.email))) || {};
    } catch (falha) {
      pendente = {};
    }

    const novo = {
      id: usuario.id,
      nome: pendente.nome || (usuario.user_metadata && usuario.user_metadata.name) || "",
      usuario: pendente.usuario || ""
    };
    const criado = await db.from("perfis").upsert(novo);
    if (criado.error) {
      console.error(criado.error);
    } else {
      try { localStorage.removeItem(chavePendente(usuario.email)); } catch (falha) { /* tudo bem */ }
    }
    linha = { nome: novo.nome, usuario: novo.usuario, foto: "", tema: null, banco_favorito: null };
  }

  const perfil = {
    nome: linha.nome,
    usuario: linha.usuario,
    foto: linha.foto,
    tema: linha.tema,
    bancoFavorito: linha.banco_favorito || null,
    email: usuario.email
  };
  sessionStorage.setItem(chave, JSON.stringify(perfil));
  return perfil;
}

async function salvarPerfil(campos) {
  const usuario = await usuarioAtual();
  if (!usuario) throw new Error("Sem login");

  const { error } = await db.from("perfis").upsert(Object.assign({ id: usuario.id }, campos));
  if (error) throw error;

  return buscarPerfil(true);
}

// Salva (ou limpa, com null) o banco favorito e atualiza a cópia guardada do perfil
async function salvarBancoFavorito(banco) {
  const usuario = await usuarioAtual();
  if (!usuario) throw new Error("Sem login");

  const { error } = await db.from("perfis").upsert({ id: usuario.id, banco_favorito: banco });
  if (error) throw error;

  try {
    const chave = "perfil:" + usuario.id;
    const guardado = JSON.parse(sessionStorage.getItem(chave));
    if (guardado) {
      guardado.bancoFavorito = banco;
      sessionStorage.setItem(chave, JSON.stringify(guardado));
    }
  } catch (falha) {
    // sem cópia guardada: na próxima página o perfil é buscado de novo
  }
}


// ---------- Atualizar ao voltar para a aba ----------
// Se a pessoa ficou fora da aba por um tempo (ou mexeu em outro aparelho), busca os dados de novo.
// Não atualiza no meio de algo: modal aberto, tour em andamento ou campo sendo preenchido.
function recarregarAoVoltar(recarregarSemAnimacao) {
  const ESPERA = 30 * 1000;
  // Quando os dados chegam de novo, os valores em R$ que mudaram sobem (ou descem) até o novo total
  const recarregar = async function () {
    const antes = valoresDaTela();
    await recarregarSemAnimacao();
    animarValores(antes);
  };
  let saiuEm = null;

  document.addEventListener("visibilitychange", async function () {
    if (document.hidden) {
      saiuEm = Date.now();
      return;
    }
    if (saiuEm === null || Date.now() - saiuEm < ESPERA) return;
    saiuEm = null;

    const campo = document.activeElement;
    const digitando = !!campo && /^(INPUT|TEXTAREA|SELECT)$/.test(campo.tagName);
    if (digitando || document.querySelector(".modal-fundo, .tour-balao") || tourDeExemploAtivo()) return;

    try {
      await recarregar();
    } catch (falha) {
      console.error(falha); // sem internet, por exemplo: a tela continua como estava
    }
  });

  ouvirMudancasDosGastos(recarregar);
}

// ---------- Valores que sobem ao atualizar ----------
// Valores em R$ soltos num elemento ("R$ 1.241,35" ou "Total R$ 656,29"). Linhas de lista ficam de fora:
// lá a posição muda quando entra um gasto novo, e a animação sairia do valor errado.
const PADRAO_VALOR_VIVO = /^(Total\s+)?R\$\s*([\d.]+,\d{2})$/;

function caminhoDoElemento(el) {
  const partes = [];
  while (el && el !== document.body) {
    if (el.id) {
      partes.unshift("#" + el.id);
      break;
    }
    const irmaos = Array.prototype.filter.call(el.parentNode.children, function (i) { return i.tagName === el.tagName; });
    partes.unshift(el.tagName + ":" + irmaos.indexOf(el));
    el = el.parentNode;
  }
  return partes.join(">");
}

function elementosDeValor() {
  return Array.prototype.filter.call(document.querySelectorAll("main *"), function (el) {
    return el.children.length === 0 && !el.closest("li, .item-parcela, .assinatura") && PADRAO_VALOR_VIVO.test(el.textContent.trim());
  });
}

function valoresDaTela() {
  const mapa = {};
  elementosDeValor().forEach(function (el) {
    mapa[caminhoDoElemento(el)] = Number(el.textContent.trim().match(PADRAO_VALOR_VIVO)[2].replace(/\./g, "").replace(",", "."));
  });
  return mapa;
}

function animarValores(antes) {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const DURACAO = 900;

  elementosDeValor().forEach(function (el) {
    const caminho = caminhoDoElemento(el);
    if (!(caminho in antes)) return;
    const textoFinal = el.textContent;
    const partes = textoFinal.trim().match(PADRAO_VALOR_VIVO);
    const prefixo = partes[1] || "";
    const destino = Number(partes[2].replace(/\./g, "").replace(",", "."));
    const origem = antes[caminho];
    if (origem === destino || !isFinite(origem) || !isFinite(destino)) return;

    const inicio = performance.now();
    function passo(agora) {
      if (!el.isConnected) return;
      const andamento = Math.min((agora - inicio) / DURACAO, 1);
      const suave = 1 - Math.pow(1 - andamento, 3); // começa rápido e vai desacelerando até o valor
      el.textContent = andamento >= 1
        ? textoFinal
        : prefixo + (origem + (destino - origem) * suave).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      if (andamento < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  });
}

// Tempo real: quando outra pessoa do espaço (ou outro aparelho seu) mexe nos gastos, entra, sai ou muda algo
// no espaço, a tela atualiza sozinha. Precisa do arquivo ferramentas/supabase-tempo-real.sql rodado uma vez;
// sem ele, nada quebra, só não chega o aviso.
function ouvirMudancasDosGastos(recarregar) {
  let espera = null;

  function emUso() {
    const campo = document.activeElement;
    const digitando = !!campo && /^(INPUT|TEXTAREA|SELECT)$/.test(campo.tagName);
    return digitando || !!document.querySelector(".modal-fundo, .tour-balao") || tourDeExemploAtivo();
  }

  async function atualizar() {
    espera = null;
    if (document.hidden) return; // ao voltar para a aba, recarregarAoVoltar cuida
    if (emUso()) {
      espera = setTimeout(atualizar, 2000); // não atualiza no meio de algo: tenta de novo daqui a pouco
      return;
    }
    try {
      await recarregar();
    } catch (falha) {
      console.error(falha);
    }
  }

  function avisar(esquecer) {
    return function () {
      // entrou ou saiu alguém: o espaço (membros, nomes, fotos) precisa ser buscado de novo
      if (esquecer) esquecerEspaco();
      if (espera) clearTimeout(espera);
      espera = setTimeout(atualizar, 400); // junta várias mudanças seguidas numa só atualização
    };
  }

  db.channel("gastos-ao-vivo-" + Math.random().toString(36).slice(2))
    .on("postgres_changes", { event: "*", schema: "public", table: "gastos" }, avisar(false))
    .on("postgres_changes", { event: "*", schema: "public", table: "historico_espaco" }, avisar(false))
    .on("postgres_changes", { event: "*", schema: "public", table: "membros" }, avisar(true))
    .on("postgres_changes", { event: "*", schema: "public", table: "espacos" }, avisar(true))
    .subscribe();
}

// ---------- Espaço compartilhado ----------
// Cada pessoa pode estar em um espaço (até 6 pessoas). Os gastos têm dois lados:
// "Pessoal" (só dela) e o espaço (de todos). O lado escolhido fica guardado neste aparelho.
const CHAVE_ESCOPO = "dashvia:escopo";
const CATEGORIAS_ESPACO = ["Compras", "Mercado", "Boleto", "Assinatura"];
const MAXIMO_MEMBROS = 6;
const NOME_MAXIMO_ESPACO = 14; // cabe numa linha no título "Gastos <nome>" no celular

let espacoEmAndamento = null;
let nomesEmAndamento = null;

// Depois de criar, entrar ou sair de um espaço, a próxima consulta busca tudo de novo
function esquecerEspaco() {
  espacoEmAndamento = null;
  nomesEmAndamento = null;
}

function escopoEscolhido() {
  // Há páginas que só existem no lado pessoal (Assinaturas): elas fixam o lado antes de buscar os gastos
  if (window.dashviaEscopoFixo) return window.dashviaEscopoFixo === "espaco";
  try {
    return localStorage.getItem(CHAVE_ESCOPO) === "espaco";
  } catch (falha) {
    return false;
  }
}

function escolherEscopo(tipo) {
  try {
    localStorage.setItem(CHAVE_ESCOPO, tipo === "espaco" ? "espaco" : "pessoal");
  } catch (falha) {
    // sem armazenamento local: a pessoa volta para "Pessoal" a cada página
  }
}

// O espaço da pessoa ({ id, nome, liderId, souLider, meuId }) ou null se ela não está em nenhum
function meuEspaco() {
  if (!espacoEmAndamento) {
    espacoEmAndamento = buscarMeuEspaco().catch(function (falha) {
      espacoEmAndamento = null;
      console.error(falha);
      return null;
    });
  }
  return espacoEmAndamento;
}

async function buscarMeuEspaco() {
  const usuario = await usuarioAtual();
  if (!usuario) return null;

  const { data, error } = await db
    .from("membros")
    .select("espaco_id, espacos(id, nome, lider_id)")
    .eq("user_id", usuario.id)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.espacos) return null;

  return {
    id: data.espaco_id,
    nome: data.espacos.nome,
    liderId: data.espacos.lider_id,
    souLider: data.espacos.lider_id === usuario.id,
    meuId: usuario.id
  };
}

// O espaço que a página deve mostrar agora: null quando a pessoa está no lado "Pessoal"
async function escopoAtual() {
  if (!escopoEscolhido()) return null;
  return meuEspaco();
}

async function listarMembros() {
  const { data, error } = await db.rpc("listar_membros");
  if (error) throw error;
  return data.map(function (m) {
    return { id: m.id, nome: m.nome, usuario: m.usuario, foto: m.foto, lider: m.eh_lider, entrouEm: m.entrou_em };
  });
}

// { idDaPessoa: nome } dos membros, para mostrar quem lançou cada gasto
function nomesDoEspaco() {
  if (!nomesEmAndamento) {
    nomesEmAndamento = listarMembros().then(function (lista) {
      const mapa = {};
      lista.forEach(function (m) { mapa[m.id] = m.nome; });
      return mapa;
    }).catch(function (falha) {
      nomesEmAndamento = null;
      console.error(falha);
      return {};
    });
  }
  return nomesEmAndamento;
}

function primeiroNome(nome) {
  return String(nome || "").trim().split(/\s+/)[0] || "";
}

// "por Ana" embaixo do nome do gasto, só nos gastos do espaço
function autorHtml(gasto) {
  if (!gasto || !gasto.espacoId || !gasto.autorNome) return "";
  const nome = primeiroNome(gasto.autorNome)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return '<small class="por-autor">por ' + nome + "</small>";
}

// ----- Ações do espaço (as regras ficam no banco; aqui só chamamos e traduzimos o erro) -----
const CODIGOS_ERRO_ESPACO = [
  "NOME_INVALIDO", "JA_TEM_ESPACO", "CODIGO_INVALIDO", "ESPACO_CHEIO", "SO_LIDER", "USE_SAIR",
  "NAO_E_MEMBRO", "JA_E_LIDER", "SEM_ESPACO", "PASSE_LIDERANCA", "USE_EXCLUIR_ESPACO", "REMOVA_MEMBROS", "CONVITES_DEMAIS"
];

const TEXTOS_ERRO_ESPACO = {
  NOME_INVALIDO: "Use um nome de 2 a 30 letras.",
  JA_TEM_ESPACO: "Você já está em um espaço. Saia dele antes de criar ou entrar em outro.",
  CODIGO_INVALIDO: "Código inválido, já usado ou vencido. Peça um novo ao líder do espaço.",
  ESPACO_CHEIO: "Esse espaço já tem " + MAXIMO_MEMBROS + " pessoas.",
  SO_LIDER: "Só o líder do espaço pode fazer isso.",
  USE_SAIR: "Para você mesmo sair, use o botão \"Sair do espaço\".",
  NAO_E_MEMBRO: "Essa pessoa não está mais no espaço.",
  JA_E_LIDER: "Você já é o líder.",
  SEM_ESPACO: "Você não está em nenhum espaço.",
  PASSE_LIDERANCA: "Você é o líder. Passe a liderança para outra pessoa antes de sair.",
  USE_EXCLUIR_ESPACO: "Você é a única pessoa aqui. Use \"Excluir espaço\".",
  REMOVA_MEMBROS: "Remova os outros membros antes de excluir o espaço.",
  CONVITES_DEMAIS: "Você já tem 10 convites ativos. Use ou espere vencer antes de gerar outro."
};

function textoDoErroEspaco(erro) {
  return (erro && TEXTOS_ERRO_ESPACO[erro.codigo]) || "Não foi possível concluir. Tente de novo.";
}

async function chamarEspaco(funcao, parametros) {
  const resposta = await db.rpc(funcao, parametros || {});
  if (resposta.error) {
    const msg = String(resposta.error.message || "");
    const codigo = CODIGOS_ERRO_ESPACO.find(function (c) { return msg.includes(c); }) || "OUTRO";
    return { error: { codigo: codigo, original: resposta.error }, data: null };
  }
  esquecerEspaco();
  return { error: null, data: resposta.data };
}

async function criarEspaco(nome) {
  const resposta = await chamarEspaco("criar_espaco", { p_nome: nome });
  if (!resposta.error) escolherEscopo("espaco");
  return resposta;
}

async function entrarComCodigo(codigo) {
  const resposta = await chamarEspaco("entrar_com_codigo", { p_codigo: codigo });
  if (!resposta.error) escolherEscopo("espaco");
  return resposta;
}

function gerarConvite() {
  return chamarEspaco("gerar_convite");
}

function removerMembro(idDaPessoa) {
  return chamarEspaco("remover_membro", { p_user: idDaPessoa });
}

function passarLideranca(idDaPessoa) {
  return chamarEspaco("passar_lideranca", { p_novo: idDaPessoa });
}

async function sairDoEspaco() {
  const resposta = await chamarEspaco("sair_do_espaco");
  if (!resposta.error) escolherEscopo("pessoal");
  return resposta;
}

async function excluirEspaco() {
  const resposta = await chamarEspaco("excluir_espaco");
  if (!resposta.error) escolherEscopo("pessoal");
  return resposta;
}

// Últimos 30 dias de alterações nos gastos do espaço (o banco já esconde o que passou disso)
async function buscarHistoricoDoEspaco() {
  const { data, error } = await db
    .from("historico_espaco")
    .select("id, nome_pessoa, acao, plataforma, categoria, valor, quando")
    .order("quando", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

// ----- Seletor "Pessoal | nome do espaço" no topo das páginas -----
async function montarSeletorEscopo() {
  const cabecalho = document.querySelector(".conteudo header");
  if (!cabecalho || document.getElementById("seletor-escopo")) return;

  const pagina = (location.pathname.split("/").pop() || "dashboard").replace(/\.html$/, "");
  if (pagina === "configuracoes" || pagina === "espaco" || pagina === "historico" || pagina === "assinaturas") return;

  const espaco = await meuEspaco();
  if (!espaco || document.getElementById("seletor-escopo")) return;

  const noEspaco = escopoEscolhido();
  const caixa = document.createElement("div");
  caixa.id = "seletor-escopo";
  caixa.className = "seletor-escopo";
  caixa.setAttribute("role", "group");
  caixa.setAttribute("aria-label", "Ver gastos pessoais ou do espaço");

  [["pessoal", "Pessoal"], ["espaco", espaco.nome]].forEach(function (opcao) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = opcao[1];
    botao.title = opcao[1];
    const ativo = (opcao[0] === "espaco") === noEspaco;
    botao.className = ativo ? "ativo" : "";
    botao.setAttribute("aria-pressed", String(ativo));
    botao.addEventListener("click", function () {
      if (ativo || caixa.dataset.trocando) return;
      caixa.dataset.trocando = "1";
      escolherEscopo(opcao[0]);

      // o destaque troca de botão e o conteúdo some com um fade antes de recarregar
      caixa.querySelectorAll("button").forEach(function (b) {
        const agora = b === botao;
        b.classList.toggle("ativo", agora);
        b.setAttribute("aria-pressed", String(agora));
      });
      const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!movimentoReduzido) {
        try { sessionStorage.setItem("dashvia:troca-escopo", "1"); } catch (e) {}
        document.documentElement.classList.add("saindo-escopo");
      }
      setTimeout(function () { window.location.reload(); }, movimentoReduzido ? 0 : 200);
    });
    caixa.appendChild(botao);
  });

  cabecalho.appendChild(caixa);
}

// depois de trocar Pessoal <-> espaço, o conteúdo da página nova entra com fade
try {
  if (sessionStorage.getItem("dashvia:troca-escopo")) {
    sessionStorage.removeItem("dashvia:troca-escopo");
    document.documentElement.classList.add("entrando-escopo");
    setTimeout(function () { document.documentElement.classList.remove("entrando-escopo"); }, 600);
  }
} catch (e) {}

montarSeletorEscopo();

// "agora", "há 5 min", "há 3 h" ou a data, para mostrar quando algo aconteceu
function tempoDecorrido(texto) {
  const data = new Date(texto);
  if (isNaN(data.getTime())) return "";
  const minutos = Math.max(0, Math.round((Date.now() - data.getTime()) / 60000));
  if (minutos < 1) return "agora";
  if (minutos < 60) return "há " + minutos + " min";
  const horas = Math.round(minutos / 60);
  if (horas < 24) return "há " + horas + " h";
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ----- Senha fraca: bloqueia as senhas de 6 números mais óbvias -----
const SENHAS_COMUNS = [
  "123456", "654321", "123123", "321321", "112233", "121212", "101010", "202020", "102030", "123321",
  "159753", "159357", "147258", "147852", "123654", "123789", "456789", "789456", "987654", "246810",
  "135790", "142536", "121314", "111222", "696969", "007007", "520520", "654123", "741852", "963852",
  "123457", "123450", "012345", "543210", "100000", "200000", "010101", "020202", "131313", "151515"
];

function senhaFraca(senha) {
  const s = String(senha);
  if (SENHAS_COMUNS.includes(s)) return true;
  if (/^(\d)\1+$/.test(s)) return true;              // 000000, 111111...
  if (/^(\d\d)\1\1$/.test(s)) return true;           // 121212, 454545...
  if (/^(\d\d\d)\1$/.test(s)) return true;           // 123123, 456456...
  if (/^(\d)\1(\d)\2(\d)\3$/.test(s)) return true;   // 112233, 445566...
  if (/^(\d)(\d)(\d)\3\2\1$/.test(s)) return true;   // 123321, 456654...
  const passos = [];
  for (let i = 1; i < s.length; i++) passos.push(Number(s[i]) - Number(s[i - 1]));
  // sequência que sobe ou desce de 1 em 1 (123456, 345678, 876543...), incluindo a volta 9 -> 0
  if (passos.every(function (p) { return p === 1 || p === -9; })) return true;
  if (passos.every(function (p) { return p === -1 || p === 9; })) return true;
  return false;
}

const TEXTO_SENHA_FRACA = "Essa senha é muito fácil de adivinhar (como 123456 ou 111111). Escolha outra.";
