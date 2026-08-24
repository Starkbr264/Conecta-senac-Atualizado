/*
 * TemaContext.tsx — Provedor de tema claro/escuro do mobile.
 *
 * Espelha o comportamento do web (css/variables.css com [data-theme]):
 *   - A preferência é salva no AsyncStorage (equivale ao localStorage do web);
 *   - aplicarPaleta() reescreve o objeto global `Colors` com as cores do tema;
 *   - `pronto` evita o "flash" de tema errado na primeira renderização.
 *
 * Uso:
 *   const { tema, paleta, pronto, alternar, setTema } = useTema();
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Paleta, paletaClara, paletaEscura } from './paletas';
import { aplicarPaleta, K_TEMA } from './theme';

// Tema claro/escuro espelhado do web (css/variables.css com [data-theme="dark"])
export type Tema = 'claro' | 'escuro';

// O que o hook useTema() expõe para as telas.
type TemaContexto = {
  tema: Tema;                 // tema atual ('claro' | 'escuro')
  paleta: Paleta;             // paleta completa do tema atual
  pronto: boolean;            // true após ler a preferência salva
  alternar: () => void;       // alterna entre claro/escuro
  setTema: (t: Tema) => void; // define um tema específico
};

// Contexto React consumido por useTema().
const Contexto = createContext<TemaContexto | null>(null);

// Paletas disponíveis (definidas em paletas.ts).
const PALETAS: Record<Tema, Paleta> = {
  claro: paletaClara,
  escuro: paletaEscura,
};

// Provedor: lê a preferência salva, aplica as cores e expõe o controle.
export function TemaProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTemaState] = useState<Tema>('claro');
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem(K_TEMA);
        const proximo: Tema = t === 'escuro' ? 'escuro' : 'claro';
        setTemaState(proximo);
        aplicarPaleta(PALETAS[proximo]);
      } catch {
        aplicarPaleta(PALETAS.claro);
      } finally {
        setPronto(true);
      }
    })();
  }, []);

  const aplicar = useCallback((t: Tema) => {
    setTemaState(t);
    aplicarPaleta(PALETAS[t]);
    AsyncStorage.setItem(K_TEMA, t).catch(() => {});
  }, []);

  const alternar = useCallback(() => {
    setTemaState(prev => {
      const proximo: Tema = prev === 'escuro' ? 'claro' : 'escuro';
      aplicarPaleta(PALETAS[proximo]);
      AsyncStorage.setItem(K_TEMA, proximo).catch(() => {});
      return proximo;
    });
  }, []);

  const paleta = useMemo(() => PALETAS[tema], [tema]);

  const valor = useMemo(
    () => ({ tema, paleta, pronto, alternar, setTema: aplicar }),
    [tema, paleta, pronto, alternar, aplicar]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTema(): TemaContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useTema deve ser usado dentro de <TemaProvider>.');
  return ctx;
}
