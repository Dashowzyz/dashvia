// Conexão com o Neon (banco de dados + login)
// O arquivo neon.bundle.js (gerado por "npm run build") cria window.dashviaNeon.
// Quem protege os dados são as regras do banco (Row Level Security), não este arquivo.
const db = window.dashviaNeon;

// ---------- Senha ----------
// O Dashvia pede 6 números, mas o login do Neon exige no mínimo 8 caracteres.
// Por isso o PIN ganha um sufixo fixo antes de ir para o Neon. A tela continua com 6 números.
// ATENÇÃO: não mude este sufixo depois de ter usuários, ou ninguém consegue mais entrar.
const SUFIXO_SENHA = "-dashvia";

function senhaDoPin(pin) {
  return pin + SUFIXO_SENHA;
}

// Traduz os erros do login do Neon para tipos simples que as páginas entendem
function tipoDoErro(erro) {
  const codigo = String((erro && erro.code) || "").toUpperCase();
  const msg = String((erro && erro.message) || "").toLowerCase();

  if (codigo.includes("EMAIL_NOT_VERIFIED") || msg.includes("not verified")) return "nao_confirmado";
  if (codigo.includes("INVALID_EMAIL_OR_PASSWORD") || codigo.includes("INVALID_PASSWORD") ||
      msg.includes("invalid email or password") || msg.includes("invalid password")) return "credenciais";
  if (codigo.includes("USER_ALREADY_EXISTS") || msg.includes("already exists")) return "ja_cadastrado";
  if (erro && erro.status === 429) return "muitas_tentativas";
  if (codigo.includes("TOKEN") || msg.includes("token")) return "link_invalido";
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
      const usuario = (dados && (dados.user || (dados.session && dados.session.user))) || null;
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
  return resultado(await db.auth.signIn.email({ email: email, password: senhaDoPin(pin) }));
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
  const criada = resultado(await db.auth.signUp.email({
    email: email,
    password: senhaDoPin(pin),
    name: nome
  }));
  if (criada.error) return criada;

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
  return resultado(await db.auth.requestPasswordReset({ email: email, redirectTo: enderecoDaPagina }));
}

// "token" vem no endereço da página de redefinição (?token=...)
async function redefinirSenha(token, pin) {
  return resultado(await db.auth.resetPassword({ newPassword: senhaDoPin(pin), token: token }));
}

async function alterarSenha(pinAtual, pinNovo) {
  return resultado(await db.auth.changePassword({
    currentPassword: senhaDoPin(pinAtual),
    newPassword: senhaDoPin(pinNovo),
    revokeOtherSessions: false
  }));
}

async function alterarEmail(novoEmail) {
  try {
    return resultado(await db.auth.changeEmail({
      newEmail: novoEmail,
      callbackURL: new URL("login.html", window.location.href).href
    }));
  } catch (falha) {
    // o Neon às vezes lança o erro em vez de devolvê-lo
    return resultado({ error: falha });
  }
}

// Apaga a conta (e, em cascata, o perfil e os gastos). Confere a senha antes.
async function excluirConta(email, pin) {
  const conferencia = await entrar(email, pin);
  if (conferencia.error) return conferencia;

  const resposta = await db.rpc("excluir_minha_conta");
  if (resposta.error) return { error: { tipo: "outro", original: resposta.error }, data: null };

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
function doBanco(linha) {
  return {
    id: linha.id,
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

async function buscarGastos() {
  const { data, error } = await db.from("gastos").select("*").order("id", { ascending: true });
  if (error) throw error;
  if (data.length === 0 && tourDeExemploAtivo()) return gastosDeExemplo();
  return data.map(doBanco);
}

// Nomes das categorias já usadas nos gastos da pessoa (para montar a lista, com as que ela criou)
async function buscarCategoriasUsadas() {
  const { data, error } = await db.from("gastos").select("categoria");
  if (error) throw error;
  return Array.from(new Set(data.map(function (linha) { return linha.categoria; })));
}

async function adicionarGasto(gasto) {
  const { data, error } = await db.from("gastos").insert(paraBanco(gasto)).select().single();
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

  // No Supabase um gatilho criava o perfil no cadastro. Aqui ele é criado no primeiro acesso.
  if (!linha) {
    let pendente = {};
    try {
      pendente = JSON.parse(localStorage.getItem(chavePendente(usuario.email))) || {};
    } catch (falha) {
      pendente = {};
    }

    const novo = {
      id: usuario.id,
      nome: pendente.nome || usuario.name || "",
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
