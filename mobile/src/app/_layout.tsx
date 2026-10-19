/*
 * _layout.tsx — Layout raiz do app mobile.
 *
 * Responsabilidades:
 *   - Envolve toda a aplicação com os provedores de contexto:
 *       TemaProvider    -> controla tema claro/escuro (espelha o web)
 *       ConfirmProvider -> modal de confirmação que funciona também no
 *                          react-native-web (onde Alert.alert é silencioso)
 *   - Define a navegação em pilha (Stack) com as rotas de cada perfil.
 *
 * A árvore é: TemaProvider -> ConfirmProvider -> Stack (telas).
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TemaProvider, useTema } from '@/theme/TemaContext';
import { ConfirmProvider } from '@/components/ConfirmProvider';

// Componente raiz: aplica os contextos globais e renderiza a navegação.
export default function RootLayout() {
  return (
    <TemaProvider>            {/* provê tema claro/escuro para todas as telas */}
      <ConfirmProvider>       {/* provê o modal de confirmação (ex.: excluir) */}
        <RaizComTema />
      </ConfirmProvider>
    </TemaProvider>
  );
}

// Espera o tema ser carregado do AsyncStorage antes de pintar a UI.
// A chave `key={tema}` força a Stack a ser recriada ao trocar de tema,
// garantindo que todas as telas usem as cores atualizadas.
function RaizComTema() {
  const { tema, pronto } = useTema();

  // Enquanto o tema não foi lido, não renderiza nada (evita "flash" errado).
  if (!pronto) return null;

  return (
    <Tela key={tema} />
  );
}

// Pilha de navegação do expo-router.
// Cada rota é uma tela; `headerShown: false` esconde o header nativo
// porque cada tela já desenha o seu próprio cabeçalho (ScreenShell).
function Tela() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />             {/* landing page */}
        <Stack.Screen name="login/index" />       {/* tela de login */}
        <Stack.Screen name="admin/index" />       {/* painel do administrador */}
        <Stack.Screen name="coordenador/index" /> {/* painel do coordenador */}
        <Stack.Screen name="recepcao/index" />    {/* painel da recepção */}
        <Stack.Screen name="instrutor/index" />   {/* painel do instrutor */}
      </Stack>
    </>
  );
}
