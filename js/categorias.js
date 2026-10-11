// Categorias do Dashvia.
// As padrão ficam aqui. As que a pessoa cria não precisam de cadastro à parte:
// qualquer categoria usada nos gastos dela que não seja padrão conta como "criada por ela".

const CATEGORIAS_PADRAO = ["Alimentação", "Compras", "Transportes", "Assinatura", "Boleto", "Outros"];
const NOVA_CATEGORIA = "__nova__"; // valor da opção "+ Nova categoria" nas listas
const TAMANHO_MAXIMO_CATEGORIA = 30;

// Para comparar nomes sem ligar para maiúsculas, acentos ou espaços a mais
function normalizarNome(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Categorias criadas pela pessoa: as usadas nos gastos que não são das padrão
function categoriasPersonalizadas(usadas) {
  const vistas = new Set(CATEGORIAS_PADRAO.map(normalizarNome));
  const lista = [];

  usadas.forEach(function (nome) {
    const chave = normalizarNome(nome);
    if (!chave || vistas.has(chave)) return;
    vistas.add(chave);
    lista.push(nome);
  });

  return lista.sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
}

// Confere o nome digitado. Se já existir uma categoria igual, usa ela em vez de criar outra.
function validarNovaCategoria(texto, existentes) {
  const nome = texto.replace(/\s+/g, " ").trim();

  if (nome.length < 2) {
    return { ok: false, erro: "Digite um nome com pelo menos 2 letras." };
  }
  if (nome.length > TAMANHO_MAXIMO_CATEGORIA) {
    return { ok: false, erro: "Use no máximo " + TAMANHO_MAXIMO_CATEGORIA + " caracteres." };
  }

  const chave = normalizarNome(nome);
  if (chave === normalizarNome("Assinatura")) {
    return { ok: false, erro: "Para assinaturas, escolha a categoria Assinatura na lista." };
  }

  if (chave === normalizarNome("Boleto")) {
    return { ok: false, erro: "Para boletos, escolha a categoria Boleto na lista." };
  }

  const igual = existentes.find(function (e) { return normalizarNome(e) === chave; });
  return { ok: true, nome: igual || nome };
}

// As categorias padrão não podem ser removidas
function ehCategoriaPadrao(nome) {
  const chave = normalizarNome(nome);
  return CATEGORIAS_PADRAO.some(function (c) { return normalizarNome(c) === chave; });
}

// Todos os jeitos de escrever a mesma categoria nos gastos (ex.: "Academia" e "academia")
function variantesDaCategoria(nome, usadas) {
  const chave = normalizarNome(nome);
  return usadas.filter(function (u) { return normalizarNome(u) === chave; });
}
