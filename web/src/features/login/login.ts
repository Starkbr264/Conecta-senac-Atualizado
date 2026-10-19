/**
 * Tela de login (`login.html`).
 *
 * Migrado de `_js_original/login_page.js`.
 *
 * Fluxo preservado:
 *   1. Carrega os dados (`initDados`) e o tema.
 *   2. Se ja existe sessao valida, redireciona (`seJaLogado`).
 *   3. Popula o select de unidades.
 *   4. No submit, valida as credenciais contra `loginUser` (que consulta a
 *      API e, em caso de falha de rede, o cache local).
 *   5. Confere a unidade selecionada contra `usuario.unidadeId`.
 *   6. Grava a sessao e redireciona para o painel do perfil.
 */

import { getUnidades, initDados, loginUser, unidadePadrao } from '../../core/storage';
import { setSessao, initTema } from '../../core/theme';
import { seJaLogado, initLogo } from '../../core/auth';
import { byId, tryById } from '../../core/dom';
import type { Perfil } from '../../types';

/** Rotas de destino por perfil. */
const ROTAS: Record<Perfil, string> = {
  admin: 'admin.html',
  coordenador: 'coordenador.html',
  instrutor: 'instrutor.html',
  recepcao: 'recepcao.html',
};

/** Exibe uma mensagem de erro no bloco `#loginMsg`. */
function erro(texto: string): void {
  const msg = byId('loginMsg');
  msg.className = 'login-msg erro';
  msg.textContent = texto;
  msg.style.display = 'block';
}

/** Limpa e foca o campo de senha apos uma tentativa falha. */
function focusesSenha(): void {
  byId<HTMLInputElement>('inpSenha').value = '';
  byId<HTMLInputElement>('inpSenha').focus();
}

/** Popula `#selUnidade` com as unidades cadastradas. */
function popularUnidades(): void {
  const sel = byId<HTMLSelectElement>('selUnidade');
  const uns = getUnidades();
  if (!uns.length) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = 'Nenhuma unidade cadastrada';
    sel.innerHTML = '';
    sel.appendChild(o);
    return;
  }
  uns.forEach((u) => {
    const o = document.createElement('option');
    o.value = String(u.id);
    o.textContent = u.nome + (u.cep ? ' — ' + u.cep : '');
    sel.appendChild(o);
  });
}

/** Processa o envio do formulario de login. */
async function aoEnviar(ev: SubmitEvent): Promise<void> {
  ev.preventDefault();
  const email = byId<HTMLInputElement>('inpEmail').value.trim();
  const senha = byId<HTMLInputElement>('inpSenha').value;
  const uid = parseInt(byId<HTMLSelectElement>('selUnidade').value, 10) || null;

  if (!email || !senha) {
    erro('Preencha e-mail e senha.');
    return;
  }

  let u;
  try {
    u = await loginUser(email, senha);
  } catch {
    erro('E-mail ou senha incorretos.');
    focusesSenha();
    return;
  }
  if (!u) {
    erro('E-mail ou senha incorretos.');
    focusesSenha();
    return;
  }

  if (u.perfil !== 'admin') {
    if (!uid && getUnidades().length > 0) {
      erro('Selecione sua unidade.');
      return;
    }
    if (u.unidadeId && uid && u.unidadeId !== uid) {
      erro('Unidade incorreta para este usuário.');
      return;
    }
  }

  // `unidadeId` nunca pode ser 0/"undefined": e a chave de particionamento de
  // todo registro criado pela sessao. Antes caia em `uid ?? 0` e produzia
  // registros orfaos invisiveis em qualquer filtro por unidade.
  setSessao({ ...u, unidadeId: u.unidadeId ?? uid ?? unidadePadrao() });

  const msg = tryById('loginMsg');
  if (msg !== null) {
    msg.className = 'login-msg ok';
    msg.textContent = 'Acesso autorizado! Redirecionando…';
    msg.style.display = 'block';
  }

  setTimeout(() => {
    window.location.href = ROTAS[(u!.perfil as unknown) as Perfil] || 'login.html';
  }, 500);
}

/** Bootstrap da tela de login. */
export async function initLogin(): Promise<void> {
  await initDados();
  if (typeof initTema === 'function') initTema();
  seJaLogado();
  initLogo();

  popularUnidades();

  byId<HTMLFormElement>('fLogin').addEventListener('submit', (ev) => {
    void aoEnviar(ev as SubmitEvent);
  });
}