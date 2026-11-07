/**
 * Autenticacao e controle de sessao — portado de `auth.js` legado.
 *
 * A sessao vive em `localStorage` (escopo compartilhado entre abas, o mesmo
 * do JWT), garantindo que a identidade visual corresponda ao token usado nas
 * chamadas de API. Essa limitacao de controle de acesso no cliente ja existia
 * no projeto e esta documentada em `docs/RELATORIO_REFATORACAO.md`.
 */

import { tryById } from './dom';
import { iniciais } from './format';
import { getUnidadeById } from './storage';
import { salvarToken } from './api';
import { clearSessao, getSessao, initTema, observarSessao } from './theme';
import type { Perfil } from '../types';

/** Destino de cada perfil apos o login. */
const ROTAS: Record<Perfil, string> = {
  admin: 'admin.html',
  coordenador: 'coordenador.html',
  instrutor: 'instrutor.html',
  recepcao: 'recepcao.html',
};

/** Perfil exigido pela pagina atual (registrado por `requirePerfil`). */
let perfilExigido: Perfil | null = null;

/**
 * Mantem a identidade visual coerente com o token efetivamente usado.
 *
 * A sessao e o JWT vivem no mesmo escopo (`localStorage`), entao uma troca de
 * usuario ou um logout em qualquer aba dispara o evento `storage` aqui: a
 * pagina antiga sai imediatamente em vez de continuar mostrando painel/perfis
 * de uma sessao anterior.
 */
function observarSessaoEntreAbas(): void {
  observarSessao((sessao) => {
    const paginaLogin = window.location.pathname.endsWith('login.html');
    if (!sessao) {
      if (!paginaLogin) window.location.replace('login.html');
      return;
    }
    if (paginaLogin) {
      // Login em outra aba: vai direto ao painel do novo usuario.
      const rota = ROTAS[sessao.perfil];
      if (rota) window.location.replace(rota);
      return;
    }
    if (perfilExigido && sessao.perfil !== perfilExigido) {
      // Usuario trocou em outra aba: sai do painel da identidade anterior.
      window.location.replace(ROTAS[sessao.perfil] ?? 'login.html');
      return;
    }
    // Mesmo perfil: recarrega para reexibir dados da sessao atual sem
    // estado visual obsoleto (nome, unidade, permissoes).
    window.location.reload();
  });
}

/** Redireciona para o login quando a sessao nao tem o perfil exigido. */
export function requirePerfil(perfil: Perfil): void {
  perfilExigido = perfil;
  observarSessaoEntreAbas();
  const s = getSessao();
  if (!s || s.perfil !== perfil) {
    window.location.replace('login.html');
  }
}

/** Redireciona para o painel do perfil quando ja houver sessao ativa. */
export function seJaLogado(): void {
  const s = getSessao();
  if (!s) {
    // Login feito em outra aba: esta aba de login acompanha a nova sessao.
    observarSessao((nova) => {
      if (nova) {
        const destino = ROTAS[nova.perfil];
        if (destino) window.location.replace(destino);
      }
    });
    return;
  }
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