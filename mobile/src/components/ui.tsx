/*
 * ui.tsx — Bloco de componentes de interface reutilizáveis do mobile.
 *
 * Contém os "átomos" visuais usados em todos os painéis:
 *   Badge / StatusPill / StatusDot -> rótulos de perfil, status de turma e
 *                                     bolinha de cor do mapa de salas
 *   Card / StatCard                -> cartões de listagem e estatísticas
 *   Button                         -> botão com variantes (primary, ghost…)
 *   SearchBar                      -> campo de busca das listagens
 *   EmptyState                     -> estado vazio ("nada encontrado")
 *   SectionHeader                  -> título de bloco com subtítulo
 *
 * Todos os componentes usam as cores do tema (Colors), o que faz a UI
 * acompanhar o tema claro/escuro automaticamente — igual ao web.
 */

import React from 'react';
import {
  View, Text, TouchableOpacity,
  ActivityIndicator, StyleProp, ViewStyle, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { criarEstilos } from '@/theme/theme';

// ---- Badge (espelha .bdg do web) ----
type BadgeProps = { label: string; tone?: 'primary' | 'green' | 'red' | 'amber' | 'blue' | 'muted'; style?: StyleProp<ViewStyle> };

// Retorna as cores de fundo/texto/borda de cada tom de badge.
function getTone(tone: BadgeProps['tone']) {
  switch (tone) {
    case 'green': return { bg: Colors.greenLight, text: Colors.green, border: 'rgba(5,150,105,0.25)' };
    case 'red':   return { bg: Colors.redLight,   text: Colors.red,   border: 'rgba(220,38,38,0.25)' };
    case 'amber': return { bg: Colors.amberLight, text: Colors.amber, border: 'rgba(217,119,6,0.25)' };
    case 'blue':  return { bg: Colors.blueLight,  text: Colors.blue,  border: 'rgba(37,99,235,0.25)' };
    case 'muted': return { bg: Colors.surface2,   text: Colors.text2, border: Colors.border2 };
    default:      return { bg: Colors.primaryLight, text: Colors.primary, border: 'rgba(26,58,92,0.12)' };
  }
}

export function Badge({ label, tone = 'primary', style }: BadgeProps) {
  const c = getTone(tone);
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }, style]}>
      <Text style={[styles.badgeTxt, { color: c.text }]}>{label}</Text>
    </View>
  );
}

// ---- StatusPill (status de turma: ativa/iminente/etc) ----
export function StatusPill({ status }: { status: keyof typeof Colors.turmaStatus }) {
  const c = Colors.turmaStatus[status] ?? Colors.turmaStatus.encerrada;
  const label = { ativa: 'Ativa', iminente: 'Iminente', posterior: 'Posterior', encerrada: 'Encerrada' }[status] ?? status;
  return (
    <View style={[styles.pill, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.pillTxt, { color: c.text }]}>{label}</Text>
    </View>
  );
}

// ---- StatusDot (bolinha colorida do mapa) ----
export function StatusDot({ status, size = 10 }: { status: 'livre' | 'ocupada' | 'iminente'; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.status[status].dot }} />;
}

// ---- Card (container branco com sombra) ----
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type StatCardProps = {
  label: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'primary' | 'green' | 'amber' | 'red' | 'blue';
};

function getStatTone(tone: StatCardProps['tone']) {
  switch (tone) {
    case 'green': return { bg: Colors.greenLight, text: Colors.green };
    case 'amber': return { bg: Colors.amberLight, text: Colors.amber };
    case 'red':   return { bg: Colors.redLight,   text: Colors.red };
    case 'blue':  return { bg: Colors.blueLight,  text: Colors.blue };
    default:      return { bg: Colors.primaryLight, text: Colors.primary };
  }
}

export function StatCard({ label, value, icon, tone = 'primary' }: StatCardProps) {
  const c = getStatTone(tone);
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: c.bg }]}>
        <Ionicons name={icon} size={18} color={c.text} />
      </View>
      <Text style={[styles.statValue, { color: c.text }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

// ---- Button (primary / danger / ghost / success) ----
type BtnProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'ghost' | 'success';
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

function getBtnVariant(variant: BtnProps['variant']) {
  switch (variant) {
    case 'danger':  return { bg: Colors.red,   text: '#fff' };
    case 'success': return { bg: Colors.green, text: '#fff' };
    case 'ghost':   return { bg: 'transparent', text: Colors.text2, border: Colors.border2 };
    default:        return { bg: Colors.primary, text: '#fff' };
  }
}

export function Button({ title, onPress, variant = 'primary', icon, size = 'md', loading, disabled, style }: BtnProps) {
  const vs = getBtnVariant(variant);
  const small = size === 'sm';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.btn,
        { backgroundColor: vs.bg, borderColor: vs.border, borderWidth: vs.border ? 1 : 0 },
        small && styles.btnSm,
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vs.text} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 14 : 16} color={vs.text} style={{ marginRight: 6 }} />}
          <Text style={[styles.btnTxt, { color: vs.text }, small && { fontSize: 13 }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ---- SearchBar ----
export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Pesquisar',
  style,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.searchWrap, style]}>
      <Ionicons name="search-outline" size={18} color={Colors.text3} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.text3}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.searchInput}
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="close-circle" size={18} color={Colors.text3} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ---- EmptyState (tela vazia) ----
export function EmptyState({ icon = 'file-tray-outline', text }: { icon?: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={Colors.text3} style={{ marginBottom: 10, opacity: 0.5 }} />
      <Text style={styles.emptyTxt}>{text}</Text>
    </View>
  );
}

// ---- SectionHeader ----
export function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = criarEstilos(() => ({
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start', borderWidth: 1 },
    badgeTxt: { fontSize: 11, fontWeight: '800' },
    pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
    pillTxt: { fontSize: 11, fontWeight: '700' },
    card: {
      backgroundColor: Colors.surface, borderRadius: Colors.rLg, padding: 18,
      borderWidth: 1, borderColor: Colors.border,
      shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    },
    statCard: {
      width: '47%',
      minHeight: 116,
      padding: 16,
    },
    statIcon: {
      width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
      marginBottom: 10,
    },
    statValue: { fontSize: 28, fontWeight: '800', lineHeight: 31 },
    statLabel: {
      fontSize: 11, color: Colors.text2, marginTop: 5, fontWeight: '800',
      textTransform: 'uppercase',
    },
    btn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10,
    },
    btnSm: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8 },
    btnTxt: { fontSize: 14, fontWeight: '700' },
    searchWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
      borderRadius: 10, paddingHorizontal: 12, minHeight: 46, marginBottom: 14,
      shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
    },
    searchInput: { flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 9 },
    empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
    emptyTxt: { color: Colors.text3, fontSize: 14, textAlign: 'center' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
    sectionSub: { fontSize: 13, color: Colors.text3, marginTop: 2 },
  })
);
