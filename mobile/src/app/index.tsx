import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, SafeAreaView, ScrollView, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { criarEstilos } from '@/theme/theme';
import { useTema } from '@/theme/TemaContext';
import { Assets } from '@/constants/assets';
import * as db from '@/services/storage';

type Feature = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  tone: 'blue' | 'green' | 'amber' | 'red' | 'primary' | 'muted';
};

const FEATURES: Feature[] = [
  {
    icon: 'business-outline',
    title: 'Cadastro de Salas',
    desc: 'Registre salas com nome, capacidade, tipo (laboratório ou sala comum) e os turnos disponíveis de cada uma.',
    tone: 'blue',
  },
  {
    icon: 'school-outline',
    title: 'Gestão de Turmas',
    desc: 'Cadastre turmas com curso, instrutor responsável, data de início e encerramento. Status calculado automaticamente.',
    tone: 'green',
  },
  {
    icon: 'calendar-outline',
    title: 'Reservas Recorrentes',
    desc: 'Vincule turmas a salas por turno e dias da semana. O sistema detecta conflitos automaticamente antes de salvar.',
    tone: 'amber',
  },
  {
    icon: 'map-outline',
    title: 'Mapa de Ocupação',
    desc: 'Visualize em tempo real quais salas estão livres, ocupadas ou com reserva iminente neste momento.',
    tone: 'red',
  },
  {
    icon: 'paper-plane-outline',
    title: 'Solicitações de Sala',
    desc: 'Instrutores podem solicitar salas pontuais à coordenação. O fluxo de aprovação é todo rastreado pelo sistema.',
    tone: 'primary',
  },
  {
    icon: 'notifications-outline',
    title: 'Notificações',
    desc: 'Alertas automáticos para aprovações, recusas e avisos importantes — cada perfil vê o que é relevante para ele.',
    tone: 'muted',
  },
  {
    icon: 'key-outline',
    title: 'Controle de Chaves',
    desc: 'A recepção gerencia a retirada e devolução de chaves das salas, com histórico de quem pegou e quando.',
    tone: 'green',
  },
  {
    icon: 'contrast-outline',
    title: 'Modo Claro & Escuro',
    desc: 'Interface adaptável com tema claro e escuro. A preferência é salva automaticamente para cada usuário.',
    tone: 'blue',
  },
  {
    icon: 'business-outline',
    title: 'Multi-unidade',
    desc: 'Suporte a múltiplas unidades SENAC com seus respectivos CEPs. Cada usuário é vinculado à sua unidade.',
    tone: 'amber',
  },
];

const PERFIS = [
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Administrador',
    desc: 'Controle total do sistema. Gerencia usuários, unidades e tem acesso irrestrito a todos os dados.',
    tags: ['Usuários', 'Unidades', 'Tudo'],
    tone: 'red' as const,
  },
  {
    icon: 'ribbon-outline' as const,
    title: 'Coordenador',
    desc: 'Gerencia salas, turmas e reservas da sua unidade. Aprova ou recusa solicitações dos instrutores.',
    tags: ['Salas', 'Turmas', 'Reservas'],
    tone: 'primary' as const,
  },
  {
    icon: 'person-outline' as const,
    title: 'Instrutor',
    desc: 'Visualiza as turmas que leciona, as salas reservadas e pode solicitar salas extras à coordenação.',
    tags: ['Minhas turmas', 'Solicitações'],
    tone: 'green' as const,
  },
  {
    icon: 'key-outline' as const,
    title: 'Recepção',
    desc: 'Controla a retirada e devolução de chaves das salas e visualiza a disponibilidade geral da unidade.',
    tags: ['Chaves', 'Disponibilidade'],
    tone: 'amber' as const,
  },
];

const STEPS = [
  ['Cadastre as Salas', 'O coordenador registra as salas da unidade com capacidade e turnos disponíveis.'],
  ['Cadastre as Turmas', 'Adicione as turmas com curso, instrutor responsável e período de vigência.'],
  ['Faça as Reservas', 'Vincule turmas às salas por turno e dias da semana. O sistema verifica conflitos automaticamente.'],
  ['Monitore Tudo', 'Use o mapa de salas e o dashboard para acompanhar a ocupação em tempo real.'],
];

export default function Index() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [pronto, setPronto] = useState(false);
  const { tema, alternar } = useTema();

  useEffect(() => {
    (async () => {
      await db.initDados();
      const s = await db.getSessao();
      const rotas: Record<string, string> = {
        admin: '/admin',
        coordenador: '/coordenador',
        instrutor: '/instrutor',
        recepcao: '/recepcao',
      };
      if (s && rotas[s.perfil]) {
        router.replace(rotas[s.perfil] as never);
        return;
      }
      setPronto(true);
    })();
  }, [router]);

  const irLogin = () => router.push('/login' as never);
  const irFuncionalidades = () => scrollRef.current?.scrollTo({ y: 620, animated: true });
  const irPerfis = () => scrollRef.current?.scrollTo({ y: 1900, animated: true });

  if (!pronto) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.nav}>
        <Image source={Assets.senacLogo} style={styles.navLogo} resizeMode="contain" />
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navTema} onPress={alternar} activeOpacity={0.75}>
            <Ionicons name={tema === 'escuro' ? 'sunny-outline' : 'moon-outline'} size={18} color={Colors.text2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton} onPress={irLogin} activeOpacity={0.85}>
            <Text style={styles.navButtonTxt}>Entrar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.gridOverlay}>
            {Array.from({ length: 12 }).map((_, i) => <View key={`h-${i}`} style={styles.gridLineH} />)}
            {Array.from({ length: 8 }).map((_, i) => <View key={`v-${i}`} style={styles.gridLineV} />)}
          </View>

          <View style={styles.heroInner}>
            <View style={styles.heroLogo}>
              <Image source={Assets.senacLogo} style={styles.heroLogoImg} resizeMode="contain" />
            </View>
            <Text style={styles.heroBadge}>SENAC · DF</Text>
            <Text style={styles.heroTitle}>
              Sistema de <Text style={styles.heroAccent}>Reserva de Salas</Text>
            </Text>
            <Text style={styles.heroSub}>
              Organize a ocupação das salas do SENAC de forma simples, rápida e sem conflitos.
              Controle turmas, turnos e reservas recorrentes em um só lugar.
            </Text>

            <View style={styles.heroBtns}>
              <TouchableOpacity style={styles.primaryBtn} onPress={irLogin} activeOpacity={0.85}>
                <Text style={styles.primaryBtnTxt}>Acessar o Sistema</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={irFuncionalidades} activeOpacity={0.85}>
                <Text style={styles.outlineBtnTxt}>Como funciona</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.heroStats}>
              <HeroStat value="4" label="Perfis de usuário" />
              <HeroStat value="100%" label="Gratuito & local" />
              <HeroStat value="0" label="Conflitos de sala" />
            </View>
          </View>
        </View>

        <Section label="✦ Funcionalidades" title="Tudo que você precisa para gerenciar salas"
          subtitle="Do cadastro de salas à reserva recorrente por turma — o sistema cobre todo o fluxo de ocupação das unidades SENAC." />
        <View style={styles.cardGrid}>
          {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
        </View>

        <Section label="✦ Perfis de Acesso" title="Quem usa o sistema?"
          subtitle="Cada perfil tem um painel dedicado com as funcionalidades certas para o seu papel na unidade." />
        <View style={styles.cardGrid}>
          {PERFIS.map(p => <PerfilCard key={p.title} {...p} />)}
        </View>

        <Section label="✦ Como Funciona" title="4 passos para organizar sua unidade"
          subtitle="O fluxo padrão do sistema é simples e segue uma ordem lógica." />
        <View style={styles.cardGrid}>
          {STEPS.map(([title, desc], index) => (
            <View key={title} style={styles.stepCard}>
              <View style={styles.stepNum}><Text style={styles.stepNumTxt}>{index + 1}</Text></View>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.cardDesc}>{desc}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cta}>
          <Text style={styles.ctaTitle}>Pronto para começar?</Text>
          <Text style={styles.ctaText}>
            Acesse o sistema com seu e-mail e senha cadastrados pelo administrador.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={irLogin} activeOpacity={0.85}>
            <Text style={styles.primaryBtnTxt}>Entrar no Sistema</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerTxt}>
            © 2026 SENAC · Distrito Federal · Instrutora: Rayssa Paiva Carvalho · Aluno: Enzo Aragão Lages
          </Text>
          <Text style={styles.footerTxt}>Sistema de Reserva de Salas · Todos os direitos reservados</Text>
          <TouchableOpacity onPress={irLogin}>
            <Text style={styles.footerLink}>Acessar sistema</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function Section({ label, title, subtitle }: { label: string; title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>{subtitle}</Text>
    </View>
  );
}

function FeatureCard({ icon, title, desc, tone }: Feature) {
  const c = toneStyle(tone);
  return (
    <View style={styles.infoCard}>
      <View style={[styles.featureIcon, { backgroundColor: c.bg }]}>
        <Ionicons name={icon} size={22} color={c.text} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{desc}</Text>
    </View>
  );
}

function PerfilCard({ icon, title, desc, tags, tone }: typeof PERFIS[number]) {
  const c = toneStyle(tone);
  return (
    <View style={styles.perfilCard}>
      <View style={[styles.perfilIcon, { backgroundColor: c.bg }]}>
        <Ionicons name={icon} size={24} color={c.text} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{desc}</Text>
      <View style={styles.tags}>
        {tags.map(t => (
          <View key={t} style={styles.tag}>
            <Text style={styles.tagTxt}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function toneStyle(tone: Feature['tone']) {
  const tones = {
    blue: { bg: Colors.blueLight, text: Colors.blue },
    green: { bg: Colors.greenLight, text: Colors.green },
    amber: { bg: Colors.amberLight, text: Colors.amber },
    red: { bg: Colors.redLight, text: Colors.red },
    primary: { bg: Colors.primaryLight, text: Colors.primary },
    muted: { bg: Colors.surface2, text: Colors.text2 },
  };
  return tones[tone];
}

const styles = criarEstilos(() => ({
    safe: { flex: 1, backgroundColor: Colors.bg },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
    nav: {
      height: 66, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
      paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    navLogo: { width: 72, height: 36 },
    navRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    navTema: {
      width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: Colors.border2,
      backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center',
    },
    navButton: {
      backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 18,
      height: 36, alignItems: 'center', justifyContent: 'center',
    },
    navButtonTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
    scroll: { flex: 1 },
    content: { paddingBottom: 28 },
    hero: {
      minHeight: 520, backgroundColor: Colors.primary, overflow: 'hidden',
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 46,
    },
    gridOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: Colors.bg === '#060d16' ? 0.2 : 0.15 },
    gridLineH: { height: 1, backgroundColor: '#fff', marginTop: 47 },
    gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#fff', marginLeft: 48 },
    heroInner: { alignItems: 'center', width: '100%' },
    heroLogo: { marginBottom: 14 },
    heroLogoImg: { width: 170, height: 58, tintColor: '#fff' },
    heroBadge: {
      color: '#fbbf24', borderWidth: 1, borderColor: 'rgba(245,158,11,0.55)',
      backgroundColor: 'rgba(245,158,11,0.18)', borderRadius: 20, overflow: 'hidden',
      paddingHorizontal: 14, paddingVertical: 5, fontSize: 11, fontWeight: '800', marginBottom: 18,
    },
    heroTitle: { color: '#fff', fontSize: 34, lineHeight: 39, fontWeight: '800', textAlign: 'center' },
    heroAccent: { color: '#fbbf24' },
    heroSub: { color: 'rgba(255,255,255,0.82)', fontSize: 15, lineHeight: 24, textAlign: 'center', marginTop: 18 },
    heroBtns: { width: '100%', gap: 10, marginTop: 30 },
    primaryBtn: {
      height: 52, borderRadius: 10, backgroundColor: Colors.accent,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
    },
    primaryBtnTxt: { color: '#1a1a1a', fontSize: 15, fontWeight: '800' },
    outlineBtn: {
      height: 52, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.42)',
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
    },
    outlineBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
    heroStats: { flexDirection: 'row', gap: 14, marginTop: 36 },
    heroStat: { flex: 1, alignItems: 'center' },
    heroStatValue: { color: '#fbbf24', fontSize: 24, fontWeight: '800' },
    heroStatLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 10, fontWeight: '800', textAlign: 'center', textTransform: 'uppercase' },
    sectionHead: { paddingHorizontal: 22, paddingTop: 42, paddingBottom: 18 },
    sectionLabel: { color: Colors.primary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    sectionTitle: { color: Colors.text, fontSize: 25, lineHeight: 30, fontWeight: '800', marginTop: 10 },
    sectionSub: { color: Colors.text2, fontSize: 14, lineHeight: 22, marginTop: 10 },
    cardGrid: { paddingHorizontal: 22, gap: 12 },
    infoCard: {
      backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
      borderRadius: 14, padding: 20,
    },
    featureIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    cardTitle: { color: Colors.text, fontSize: 16, fontWeight: '800', marginBottom: 7, textAlign: 'left' },
    cardDesc: { color: Colors.text2, fontSize: 13, lineHeight: 20 },
    perfilCard: {
      backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
      borderRadius: 14, padding: 20, alignItems: 'center',
    },
    perfilIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 },
    tag: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
    tagTxt: { color: Colors.text2, fontSize: 11, fontWeight: '700' },
    stepCard: {
      backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
      borderRadius: 14, padding: 20, alignItems: 'center',
    },
    stepNum: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    stepNumTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
    cta: {
      marginHorizontal: 22, marginTop: 40, backgroundColor: Colors.primary,
      borderRadius: 18, padding: 26, alignItems: 'center',
    },
    ctaTitle: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' },
    ctaText: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 10, marginBottom: 22 },
    footer: {
      borderTopWidth: 1, borderTopColor: Colors.border,
      marginHorizontal: 22, marginTop: 26, paddingTop: 18,
      alignItems: 'center', gap: 4,
    },
    footerTxt: { color: Colors.text3, textAlign: 'center', fontSize: 11, lineHeight: 18 },
    footerLink: { color: Colors.primary, fontSize: 12, fontWeight: '700', marginTop: 4 },
  })
);
