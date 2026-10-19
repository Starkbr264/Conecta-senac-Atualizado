/*
 * login/index.tsx — Tela de login do mobile.
 *
 * Espelha a login.html do web:
 *   - Lista as unidades vindas do banco sincronizado (servidor central);
 *   - Valida e-mail/senha contra o servidor (POST /api/login) com fallback
 *     para o cache local (modo offline) — feito por db.loginUser();
 *   - Após o login, redireciona para o painel do perfil (via useAuth.entrar).
 *
 * A unidade é usada por perfis não-admin; o admin ignora a seleção.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useTema } from '@/theme/TemaContext';
import { Assets } from '@/constants/assets';
import { useAuth } from '@/hooks/useAuth';
import * as db from '@/services/storage';
import { Unidade } from '@/types';

// Tela de login — valida email/senha/unidade e redireciona por perfil
export default function LoginScreen() {
  // Estado do formulário: e-mail, senha, unidade selecionada, erro e loading.
  const router = useRouter();
  const { entrar } = useAuth();        // função de login do hook de autenticação
  const { tema } = useTema();          // tema claro/escuro (para a StatusBar)
  const [unidades, setUnidades] = useState<Unidade[]>([]); // lista de unidades
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [unidadeId, setUnidadeId] = useState<number | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);   // trava o botão
  const [mostrarSenha, setMostrarSenha] = useState(false); // olhinho da senha
  const [dropdownAberto, setDropdownAberto] = useState(false); // dropdown de unidade

  // Ao abrir a tela: inicializa os dados (sincronizando com o servidor
  // central) e carrega as unidades para popular o dropdown.
  useEffect(() => {
    (async () => {
      await db.initDados();
      setUnidades(db.getUnidades());
    })();
  }, []);

  // Submete o login: delega para useAuth.entrar(), que valida no servidor
  // central e redireciona para o painel do perfil.
  const fazerLogin = async () => {
    setErro('');
    if (!email || !senha) { setErro('Preencha e-mail e senha.'); return; }
    setCarregando(true);
    try {
      await entrar(email.trim(), senha, unidadeId);
    } catch (e) {
      setErro((e as Error).message);
      setCarregando(false);
    }
  };

  // Unidade selecionada no dropdown (para exibir o nome no campo).
  const unidadeSel = unidades.find(u => u.id === unidadeId);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle={tema === 'escuro' ? 'light-content' : 'dark-content'} backgroundColor={Colors.bg} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Cabecalho com logo */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Image source={Assets.senacLogo} style={styles.logoImg} resizeMode="contain" />
          </View>
          <Text style={styles.headerTitle}>Sistema de Reserva de Salas</Text>
          <Text style={styles.headerSub}>SENAC GDF</Text>
        </View>

        {/* Card do formulario */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Entrar</Text>
          <Text style={styles.cardSub}>Acesse com suas credenciais</Text>

          {/* Email */}
          <Text style={styles.label}>E-mail</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={Colors.text3} />
            <TextInput
              style={styles.input}
              placeholder="seu.email@senacdf.com"
              placeholderTextColor={Colors.text3}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Senha */}
          <Text style={styles.label}>Senha</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.text3} />
            <TextInput
              style={styles.input}
              placeholder="Sua senha"
              placeholderTextColor={Colors.text3}
              value={senha}
              onChangeText={setSenha}
              secureTextEntry={!mostrarSenha}
            />
            <TouchableOpacity onPress={() => setMostrarSenha(v => !v)}>
              <Ionicons name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.text3} />
            </TouchableOpacity>
          </View>

          {/* Unidade (dropdown simples) */}
          <Text style={styles.label}>Unidade</Text>
          <TouchableOpacity style={styles.inputWrap} onPress={() => setDropdownAberto(v => !v)}>
            <Ionicons name="business-outline" size={18} color={Colors.text3} />
            <Text style={[styles.input, { color: unidadeSel ? Colors.text : Colors.text3 }]}>
              {unidadeSel ? unidadeSel.nome : 'Selecione sua unidade'}
            </Text>
            <Ionicons name={dropdownAberto ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.text3} />
          </TouchableOpacity>
          {dropdownAberto && (
            <View style={styles.dropdown}>
              {unidades.map(u => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.dropdownItem}
                  onPress={() => { setUnidadeId(u.id); setDropdownAberto(false); }}
                >
                  <Text style={styles.dropdownTxt}>{u.nome}</Text>
                  {unidadeId === u.id && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Mensagem de erro */}
          {erro ? (
            <View style={styles.erroBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.red} />
              <Text style={styles.erroTxt}>{erro}</Text>
            </View>
          ) : null}

          {/* Botao */}
          <TouchableOpacity style={styles.btn} onPress={fazerLogin} disabled={carregando} activeOpacity={0.85}>
            {carregando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={18} color="#fff" />
                <Text style={styles.btnTxt}>Entrar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Link de volta para a pagina inicial (espelha o web) */}
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={14} color={Colors.text3} />
          <Text style={styles.backLinkTxt}>Sobre o sistema</Text>
        </TouchableOpacity>

        {/* Rodape com dica de credenciais */}
        <View style={styles.hint}>
          <Text style={styles.hintTitle}>Credenciais de teste</Text>
          <Text style={styles.hintTxt}>Admin: senac_gdf@hotmail.com / Senac.DF2007</Text>
          <Text style={styles.hintTxt}>Coordenador: coord.asanorte@senacdf.com / Coord@123</Text>
          <Text style={styles.hintTxt}>Instrutor: katia.barros@senacdf.com / Inst@123</Text>
          <Text style={styles.hintTxt}>Recepcao: recep.asanorte@senacdf.com / Recep@123</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 28 },
  logoBox: {
    width: 170, height: 66, borderRadius: 14, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  logoImg: { width: 154, height: 52 },
  headerTitle: { color: Colors.primary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  headerSub: {
    color: Colors.text3, fontSize: 12, marginTop: 8, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: Colors.rLg, padding: 24,
    borderWidth: 1, borderColor: Colors.border2,
    shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: Colors.text },
  cardSub: { fontSize: 14, color: Colors.text3, marginTop: 2, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.text2, marginBottom: 6, marginTop: 12 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface2,
    borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, height: 48,
  },
  input: { flex: 1, fontSize: 15, color: Colors.text },
  dropdown: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    marginTop: 4, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  dropdownTxt: { fontSize: 14, color: Colors.text },
  erroBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.redLight,
    borderRadius: 8, padding: 10, marginTop: 14,
  },
  erroTxt: { color: Colors.red, fontSize: 13, fontWeight: '600', flex: 1 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 10, height: 50, marginTop: 22,
  },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, marginTop: 20, paddingVertical: 6,
  },
  backLinkTxt: { color: Colors.text3, fontSize: 13, textDecorationLine: 'underline' },
  hint: {
    marginTop: 24, padding: 16, backgroundColor: Colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
  },
  hintTitle: { color: Colors.primary, fontSize: 13, fontWeight: '800', marginBottom: 8 },
  hintTxt: { color: Colors.text2, fontSize: 11, marginBottom: 3 },
});
