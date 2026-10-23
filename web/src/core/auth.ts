/**
 * Autenticacao e controle de sessao — portado de `auth.js` legado.
 *
 * O controle de acesso é EXCLUSIVAMENTE no cliente (comparacao de `perfil`
 * na sessao do `sessionStorage`). Essa limitacao ja existia no projeto e esta
 * documentada em `docs/RELATORIO_REFATORACAO.md`; nao foi alterada aqui.
 */

import { tryById } from './dom';
import { iniciais } from './format';
import { getUnidadeById } from './storage';
import { salvarToken } from './api';
import { clearSessao, getSessao, initTema } from './theme';
import type { Perfil } from '../types';

/** Destino de cada perfil apos o login. */
const ROTAS: Record<Perfil, string> = {
  admin: 'admin.html',
  coordenador: 'coordenador.html',
  instrutor: 'instrutor.html',
  recepcao: 'recepcao.html',
};

/** Redireciona para o login quando a sessao nao tem o perfil exigido. */
export function requirePerfil(perfil: Perfil): void {
  const s = getSessao();
  if (!s || s.perfil !== perfil) {
    window.location.replace('login.html');
  }
}

/** Redireciona para o painel do perfil quando ja houver sessao ativa. */
export function seJaLogado(): void {
  const s = getSessao();
  if (!s) return;
  const rota = ROTAS[s.perfil];
  if (rota) window.location.replace(rota);
}

/** Encerra a sessao local e volta para o login. */
export function sair(): void {
  clearSessao();
  salvarToken(null); // remove JWT do localStorage (senao o token antigo gera 401 "Sessao expirada" na proxima visita)
  window.location.replace('login.html');
}

/** Preenche nome, iniciais e unidade do usuario na sidebar. */
export function initSidebar(): void {
  const s = getSessao();
  if (!s) return;

  const nome = tryById('sbNome');
  if (nome) nome.textContent = s.nome;

  const ini = tryById('sbIniciais');
  if (ini) ini.textContent = iniciais(s.nome);

  const un = tryById('sbUnidade');
  if (un && s.unidadeId) {
    const u = getUnidadeById(s.unidadeId);
    if (u) un.textContent = u.nome;
  }

  initTema();
}

/**
 * Exibe a imagem do logo.
 *
 * O texto "SENAC · GDF" que existia como fallback foi removido do HTML. Ele
 * aparecia durante o carregamento e sumia depois (o `initLogo` roda depois do
 * `await initDados()`, ou seja, depois da sincronizacao com o servidor),
 * produzindo um "flash" visual. Agora a imagem e o unico elemento do logo.
 *
 * Se a imagem nao tiver `src`, escondemos o container inteiro em vez de
 * exibir um texto alternativo.
 */
export function initLogo(): void {
  const img = tryById<HTMLImageElement>('logoImg');
  if (!img) return;

  const wrap = tryById('logoWrap');
  if (!img.getAttribute('src') && wrap) {
    wrap.style.display = 'none';
  }
}