// Orquestração do envio. Não conhece Supabase nem a biblioteca de push: tudo entra por `deps` (veja index.ts),
// o que permite testar a regra inteira com dependências falsas.
import { calcularAvisos, hojeEmBrasilia, montarNotificacao } from "./avisos.mjs";
import { lerNovidadeMaisRecente, montarNotificacaoNovidade } from "./novidades.mjs";

const CHAVE_ULTIMA_NOVIDADE = "ultima_novidade";
const HORA_INICIAL = 8; // novidades só saem entre 08:00 e 21:00 de Brasília
const HORA_FINAL = 21;

function horaEmBrasilia(agora) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(agora));
}

// Envia para todos os aparelhos e apaga os que o serviço de push disse não existirem mais
export async function enviarParaUsuario(deps, inscricoes, notificacao) {
  let ok = 0;
  let removidas = 0;
  for (const inscricao of inscricoes) {
    const resultado = await deps.enviar(inscricao, notificacao);
    if (resultado === "ok") ok++;
    else if (resultado === "gone") {
      await deps.apagarInscricao(inscricao.id);
      removidas++;
    }
  }
  return { ok, removidas };
}

function agruparPorUsuario(inscricoes) {
  const porUsuario = new Map();
  for (const i of inscricoes) {
    if (!porUsuario.has(i.user_id)) porUsuario.set(i.user_id, []);
    porUsuario.get(i.user_id).push(i);
  }
  return porUsuario;
}

export async function executarVencimentos(deps, agora) {
  const hoje = hojeEmBrasilia(agora);
  const porUsuario = agruparPorUsuario(await deps.listarInscricoes());
  const resumo = { usuarios: porUsuario.size, enviadas: 0, removidas: 0 };

  for (const [userId, inscricoes] of porUsuario) {
    const avisos = calcularAvisos(await deps.listarGastosDe(userId), hoje);

    // só vira envio o que ainda não foi registrado: cada aviso sai uma vez
    const novos = [];
    for (const aviso of avisos) {
      if (await deps.registrarAviso(userId, aviso.chave)) novos.push(aviso);
    }
    const notificacao = montarNotificacao(novos);
    if (!notificacao) continue;

    const { ok, removidas } = await enviarParaUsuario(deps, inscricoes, notificacao);
    resumo.removidas += removidas;
    if (ok > 0) {
      resumo.enviadas++;
    } else if (removidas < inscricoes.length) {
      // todos os envios falharam por motivo temporário: libera os avisos para a próxima execução tentar de novo
      for (const aviso of novos) await deps.desfazerAviso(userId, aviso.chave);
    }
  }
  return resumo;
}

export async function executarNovidades(deps, agora) {
  const novidade = lerNovidadeMaisRecente(await deps.buscarNovidadesJs());
  if (!novidade) return { enviou: false, motivo: "formato" };

  const ultima = await deps.lerEstado(CHAVE_ULTIMA_NOVIDADE);
  if (ultima === null) {
    await deps.gravarEstado(CHAVE_ULTIMA_NOVIDADE, novidade.id);
    return { enviou: false, motivo: "primeira-vez" };
  }
  if (ultima === novidade.id) return { enviou: false, motivo: "sem-novidade" };

  const hora = horaEmBrasilia(agora);
  if (hora < HORA_INICIAL || hora >= HORA_FINAL) return { enviou: false, motivo: "fora-do-horario" };

  const notificacao = montarNotificacaoNovidade(novidade);
  const porUsuario = agruparPorUsuario(await deps.listarInscricoes());
  for (const inscricoes of porUsuario.values()) {
    await enviarParaUsuario(deps, inscricoes, notificacao);
  }
  await deps.gravarEstado(CHAVE_ULTIMA_NOVIDADE, novidade.id);
  return { enviou: true, motivo: "ok" };
}
