/*
 * useAuth.ts — Autenticação e controle de sessão no mobile.
 *
 * A sessão é a MESMA usada pelo web: o login valida no servidor central
 * (POST /api/login, via storage.loginUser) e a sessão fica salva no
 * AsyncStorage local. Assim o app lembra quem está logado entre aberturas.
 *
 * Hooks exportados:
 *   useAuth()          -> sessao, carregando, entrar(email, senha, unidadeId), sair()
 *   useRequirePerfil() -> protege uma tela: redireciona ao /login se o
 *                         perfil logado não for o esperado.
 *
 * Rotas por perfil (mesmas do web):
 *   admin -> /admin, coordenador -> /coordenador,
 *   instrutor -> /instrutor, recepcao -> /recepcao.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Sessao, Perfil } from '@/types';
import * as db from '@/services/storage';

// Mapa perfil -> rota (espelha o redirecionamento do login_page.js no web).
const ROTAS: Record<Perfil, string> = {
  admin:       '/admin',
  coordenador: '/coordenador',
  instrutor:   '/instrutor',
  recepcao:    '/recepcao',
};

// Hook central de autenticação.
export function useAuth() {
  const [sessao, setSessaoState] = useState<Sessao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();

  // No boot: carrega os dados (sincronizando com o servidor) e restaura
  // a sessão salva no AsyncStorage, se houver.
  useEffect(() => {
    (async () => {
      await db.initDados();          // carrega cache + sincroniza com o servidor
      const s = await db.getSessao(); // sessão persistida localmente
      setSessaoState(s);
      setCarregando(false);
    })();
  }, []);

  // Efetua o login: valida no servidor central (fallback offline local)
  // e redireciona para o painel do perfil correspondente.
  const entrar = useCallback(async (email: string, senha: string, unidadeId: number | null) => {
    const u = await db.loginUser(email, senha);
    if (!u) throw new Error('E-mail ou senha incorretos.');
    // Não-admin precisa informar a unidade e ela deve bater com o usuário.
    if (u.perfil !== 'admin') {
      if (!unidadeId) throw new Error('Selecione sua unidade.');
      if (u.unidadeId && unidadeId && u.unidadeId !== unidadeId)
        throw new Error('Unidade incorreta para este usuario.');
    }
    // Monta a sessão (mesmo formato do web) e persiste localmente.
    const nova: Sessao = { ...u, unidadeId: u.unidadeId || unidadeId! };
    await db.setSessao(nova);
    setSessaoState(nova);
    router.replace(ROTAS[u.perfil] as never);
    return nova;
  }, [router]);

  // Encerra a sessão e volta para a tela de login.
  const sair = useCallback(async () => {
    await db.clearSessao();
    setSessaoState(null);
    router.replace('/login' as never);
  }, [router]);

  return { sessao, carregando, entrar, sair };
}

// Hook de proteção de rota: só libera a tela se a sessão tiver o perfil certo.
// Caso contrário, redireciona para /login (equivale ao requirePerfil do web).
export function useRequirePerfil(perfil: Perfil) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [pronto, setPronto] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      await db.initDados();
      const s = await db.getSessao();
      // Sessão inexistente ou perfil incompatível -> volta ao login.
      if (!s || s.perfil !== perfil) {
        router.replace('/login' as never);
        return;
      }
      setSessao(s);
      setPronto(true);
    })();
  }, [perfil, router]);

  return { sessao, pronto };
}
