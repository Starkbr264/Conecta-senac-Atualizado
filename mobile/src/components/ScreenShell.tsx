/*
 * ScreenShell.tsx — "Casca" de tela usada por todos os painéis do mobile.
 *
 * Espelha a topbar/sidebar do web (admin.html, coordenador.html etc.)
 * adaptada para celular:
 *   - Topbar fixa: logo SENAC, badge do perfil, toggle de tema, avatar,
 *     botão de logout;
 *   - Barra de abas horizontal rolável (tabs), cada uma com ícone e badge
 *     opcional (ex.: nº de solicitações pendentes / avisos não lidos);
 *   - Área de conteúdo rolável com pull-to-refresh, que chama onRefresh
 *     (recarrega os dados sincronizando com o servidor central).
 *
 * Recebe tudo via props — cada painel define suas próprias abas e conteúdo.
 */

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, SafeAreaView, RefreshControl, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { criarEstilos } from '@/theme/theme';
import { useTema } from '@/theme/TemaContext';
import { Assets } from '@/constants/assets';
import { Sessao } from '@/types';
import { iniciais } from '@/services/storage';

// Tipo de cada aba: chave (rota interna), rótulo, ícone e badge opcional.
type TabItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number;
};

// Props que cada painel precisa fornecer ao usar o ScreenShell.
type Props = {
  sessao: Sessao | null;        // usuário logado (para o avatar/iniciais)
  perfilLabel: string;          // ex.: "Administrador", "Coordenador"…
  title: string;                // título da seção atual
  subtitle?: string;            // subtítulo explicativo
  tabs: TabItem[];              // abas disponíveis no painel
  activeTab: string;            // aba selecionada
  onTabChange: (key: string) => void;  // troca de aba
  onLogout: () => void;         // encerra a sessão
  onRefresh?: () => void;       // recarrega dados (pull-to-refresh)
  refreshing?: boolean;         // indicador de atualização
  children: React.ReactNode;    // conteúdo da aba atual
};

// Casca de tela: topbar com logo/perfil + tabs horizontais + conteúdo rolável.
export function ScreenShell({
  sessao, perfilLabel, title, subtitle, tabs, activeTab,
  onTabChange, onLogout, onRefresh, refreshing, children,
}: Props) {
  const perfilTone = getPerfilTone(perfilLabel);   // cor do badge do perfil
  const activeItem = tabs.find(t => t.key === activeTab); // aba ativa p/ topbar
  const { tema, alternar } = useTema();            // tema claro/escuro

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={tema === 'escuro' ? 'light-content' : 'dark-content'} backgroundColor={Colors.surface} />

      {/* Topbar */}
      <View style={styles.topbar}>
        <View style={styles.brand}>
          <View style={styles.logoBox}>
            <Image source={Assets.senacLogo} style={styles.logoImg} resizeMode="contain" />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.brandName}>Reservas</Text>
            <Text style={styles.brandSub}>Sistema de Salas</Text>
            <View style={[styles.perfilBadge, perfilTone.badge]}>
              <Text style={[styles.perfilBadgeTxt, perfilTone.badgeTxt]}>{perfilLabel}</Text>
            </View>
          </View>
        </View>
        <View style={styles.brandRight}>
          <TouchableOpacity onPress={alternar} style={styles.temaBtn} activeOpacity={0.75}>
            <Ionicons name={tema === 'escuro' ? 'sunny-outline' : 'moon-outline'} size={18} color={Colors.text2} />
          </TouchableOpacity>
          <View style={styles.userMini}>
            <Text style={styles.userName} numberOfLines={1}>{activeItem?.label ?? title}</Text>
            <Text style={styles.userRole} numberOfLines={1}>{perfilLabel}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{iniciais(sessao?.nome ?? 'SN')}</Text>
          </View>
          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn} activeOpacity={0.75}>
            <Ionicons name="log-out-outline" size={20} color={Colors.text2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Conteudo */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={Colors.primary} /> : undefined}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
        <View style={{ height: 96 }} />
      </ScrollView>

      <View style={styles.tabBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {tabs.map(t => {
            const active = t.key === activeTab;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => onTabChange(t.key)}
                style={[styles.tabItem, active && styles.tabItemActive]}
                activeOpacity={0.75}
              >
                <View style={styles.tabIconSlot}>
                  <Ionicons name={t.icon} size={21} color={active ? Colors.primary : Colors.text3} />
                  {t.badge ? (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeTxt}>{t.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function getPerfilTone(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('admin')) return {
    badge: { backgroundColor: Colors.redLight, borderColor: 'rgba(220,38,38,0.25)' },
    badgeTxt: { color: Colors.red },
  };
  if (normalized.includes('instrutor')) return {
    badge: { backgroundColor: Colors.greenLight, borderColor: 'rgba(5,150,105,0.25)' },
    badgeTxt: { color: Colors.green },
  };
  if (normalized.includes('recep')) return {
    badge: { backgroundColor: Colors.amberLight, borderColor: 'rgba(217,119,6,0.25)' },
    badgeTxt: { color: Colors.amber },
  };
  return {
    badge: { backgroundColor: Colors.primaryLight, borderColor: 'rgba(26,58,92,0.12)' },
    badgeTxt: { color: Colors.primary },
  };
}

const styles = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: Colors.bg },
    topbar: {
      backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    logoBox: {
      width: 58, height: 38, borderRadius: 8, backgroundColor: Colors.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    logoImg: { width: 54, height: 32 },
    brandText: { flexShrink: 1 },
    brandName: { color: Colors.primary, fontSize: 17, fontWeight: '800' },
    brandSub: { color: Colors.text3, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 1 },
    perfilBadge: {
      borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start',
      marginTop: 6, borderWidth: 1,
    },
    perfilBadgeTxt: { fontSize: 10, fontWeight: '800' },
    brandRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    userMini: { maxWidth: 96, alignItems: 'flex-end' },
    userName: { color: Colors.text, fontSize: 12, fontWeight: '700' },
    userRole: { color: Colors.text3, fontSize: 10, marginTop: 1 },
    avatar: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primaryLight,
      borderWidth: 1, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center',
    },
    avatarTxt: { color: Colors.primary, fontWeight: '800', fontSize: 12 },
    temaBtn: {
      width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: Colors.border2,
      alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface2,
    },
    logoutBtn: {
      width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: Colors.border2,
      alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface2,
    },
    content: { flex: 1 },
    contentInner: { padding: 18 },
    titleBlock: { marginBottom: 18 },
    title: { fontSize: 22, fontWeight: '800', color: Colors.text },
    subtitle: { fontSize: 13, color: Colors.text2, marginTop: 2 },
    tabBarWrap: {
      backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
      shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: -4 },
      elevation: 12,
    },
    tabBar: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 6 },
    tabItem: {
      width: 74, minHeight: 58, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 6, paddingVertical: 7,
    },
    tabItemActive: { backgroundColor: Colors.primaryLight },
    tabIconSlot: { width: 30, height: 25, alignItems: 'center', justifyContent: 'center' },
    tabBadge: {
      position: 'absolute', top: -5, right: -8, minWidth: 18, height: 18, borderRadius: 9,
      backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
    },
    tabBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
    tabLabel: { color: Colors.text3, fontSize: 10, fontWeight: '700', marginTop: 3, maxWidth: 64 },
    tabLabelActive: { color: Colors.primary, fontWeight: '800' },
  })
);
