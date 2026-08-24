/*
 * ConfirmProvider.tsx — Modal de confirmação reutilizável do mobile.
 *
 * Por que existe: no react-native-web o Alert.alert é um "no-op" silencioso
 * (não mostra nada), então botões de excluir/confirmar não funcionavam quando
 * o app rodava no navegador. Este provider substitui o Alert por um modal
 * próprio, que funciona igual em Android, iOS e Web.
 *
 * Uso:
 *   const { pedirConfirmacao } = useConfirmar();
 *   const ok = await pedirConfirmacao({ titulo, msg, confirmar, destrutivo });
 *   if (ok) { ...fazer a ação... }
 *
 * Retorna uma Promise<boolean>: true se o usuário confirmou, false se cancelou.
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/colors';
import { criarEstilos } from '@/theme/theme';

// Opções aceitas por pedirConfirmacao().
type OpcoesConfirm = {
  titulo?: string;            // título do modal
  msg: string;                // mensagem central
  confirmar?: string;         // texto do botão de confirmar
  cancelar?: string;          // texto do botão de cancelar
  destrutivo?: boolean;       // true -> botão de confirmar em vermelho
};

// O que o hook useConfirmar() expõe.
type ConfirmContexto = {
  pedirConfirmacao: (opts: OpcoesConfirm) => Promise<boolean>;
};

// Contexto React consumido por useConfirmar().
const Contexto = createContext<ConfirmContexto | null>(null);

// Provedor: guarda o estado do modal e devolve a Promise que o chamador aguarda.
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [opts, setOpts] = useState<OpcoesConfirm | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const pedirConfirmacao = useCallback((o: OpcoesConfirm) => {
    return new Promise<boolean>(resolve => {
      resolverRef.current = resolve;
      setOpts(o);
      setAberto(true);
    });
  }, []);

  const fechar = useCallback((ok: boolean) => {
    setAberto(false);
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setOpts(null);
  }, []);

  const valor = useMemo(() => ({ pedirConfirmacao }), [pedirConfirmacao]);

  const titulo = opts?.titulo ?? 'Confirmar';
  const textoOk = opts?.confirmar ?? 'Confirmar';
  const textoCancelar = opts?.cancelar ?? 'Cancelar';
  const destrutivo = opts?.destrutivo ?? false;

  return (
    <Contexto.Provider value={valor}>
      {children}
      {aberto && opts ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => fechar(false)}>
          <View style={styles.overlay}>
            <View style={styles.box}>
              <Text style={styles.titulo}>{titulo}</Text>
              <Text style={styles.msg}>{opts.msg}</Text>
              <View style={styles.botoes}>
                <TouchableOpacity style={[styles.btn, styles.btnCancelar]} onPress={() => fechar(false)} activeOpacity={0.8}>
                  <Text style={styles.btnCancelarTxt}>{textoCancelar}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, destrutivo ? styles.btnDestrutivo : styles.btnPrimario]}
                  onPress={() => fechar(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnOkTxt}>{textoOk}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </Contexto.Provider>
  );
}

export function useConfirmar(): ConfirmContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useConfirmar deve ser usado dentro de <ConfirmProvider>.');
  return ctx;
}

const styles = criarEstilos(() => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  box: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  titulo: { color: Colors.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  msg: { color: Colors.text2, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  botoes: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  btn: {
    minWidth: 110,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnCancelar: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border2 },
  btnCancelarTxt: { color: Colors.text2, fontSize: 14, fontWeight: '700' },
  btnDestrutivo: { backgroundColor: Colors.red },
  btnPrimario: { backgroundColor: Colors.primary },
  btnOkTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
}));
