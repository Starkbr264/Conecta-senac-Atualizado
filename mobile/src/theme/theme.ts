import { ImageStyle, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { Paleta, paletaClara } from './paletas';

/**
 * Núcleo de tema global.
 *
 * `Colors` é um objeto mutável que sempre reflete a paleta ativa. Componentes
 * criam estilos via `criarEstilos(factory)` — a factory roda agora e é
 * registrada; ao trocar o tema, re-executamos as factories (que leem `Colors`
 * já mutado) e substituímos os valores in-place. Como os estilos são objetos JS
 * puros, a mutação reflete na UI no próximo re-render (key={tema} no layout).
 */

export type { Paleta } from './paletas';

export const K_TEMA = '@sn_tema_v1';

// Objeto global de cores — mesma forma do antigo Colors de constants/colors.ts
export const Colors = { ...paletaClara } as Paleta;
// Copia aninhada para os objetos internos
Colors.turno = { ...paletaClara.turno };
Colors.status = { ...paletaClara.status };
Colors.turmaStatus = { ...paletaClara.turmaStatus };

type EstiloRN = ViewStyle | TextStyle | ImageStyle;
type NamedStyles = Record<string, EstiloRN>;

const factories = new Set<{ styles: NamedStyles; factory: () => NamedStyles }>();

/**
 * Registra um objeto de estilos com sua factory. A factory é re-executada
 * sempre que o tema muda (lendo os valores já mutados de `Colors`).
 */
export function registrarEstilos<T extends NamedStyles>(
  styles: T,
  factory: () => T
): T {
  factories.add({ styles, factory: factory as unknown as () => NamedStyles });
  return styles;
}

/**
 * Cria estilos com suporte a tema. O retorno da factory é contextualizado
 * contra `StyleSheet.NamedStyles<N>` — o mesmo mecanismo de contextual typing
 * do `StyleSheet.create` — preservando os tipos literais (ex:
 * `alignSelf: 'flex-start'`) e validando as propriedades como estilos do React
 * Native. O retorno são objetos JS puros, mutáveis e aceitos em `style` em
 * qualquer plataforma.
 */
export function criarEstilos<T extends StyleSheet.NamedStyles<T>>(
  factory: () => T
): T {
  const styles = factory();
  registrarEstilos(styles as unknown as NamedStyles, factory as unknown as () => NamedStyles);
  return styles;
}

/** Aplica uma paleta: muta `Colors` e regenera todos os estilos registrados. */
export function aplicarPaleta(p: Paleta): void {
  Object.assign(Colors, p);
  Object.assign(Colors.turno, p.turno);
  Object.assign(Colors.status, p.status);
  Object.assign(Colors.turmaStatus, p.turmaStatus);

  for (const { styles, factory } of factories) {
    const novo = factory();
    for (const chave of Object.keys(novo)) {
      const alvo = styles[chave];
      if (alvo) {
        Object.assign(alvo, novo[chave]);
      }
    }
  }
}
