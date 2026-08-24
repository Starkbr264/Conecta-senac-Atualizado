// Dentro do teu ecrã:
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Modal,
  TextInput, TouchableOpacity, ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useRequirePerfil, useAuth } from '@/hooks/useAuth';
import { ScreenShell } from '@/components/ScreenShell';
import { Card, Badge, StatusPill, Button, EmptyState, SearchBar, StatCard } from '@/components/ui';
import { useConfirmar } from '@/components/ConfirmProvider';
import Calendario from '@/components/Calendario';
import * as db from '@/services/storage';
import { Usuario, Unidade, Perfil, Sessao } from '@/types';

const TABS = [
  { key: 'dashboard', label: 'Painel',   icon: 'grid-outline' as const },
  { key: 'usuarios',  label: 'Usuarios', icon: 'people-outline' as const },
  { key: 'unidades',  label: 'Unidades', icon: 'business-outline' as const },
  { key: 'salas',     label: 'Salas',    icon: 'easel-outline' as const },
  { key: 'turmas',    label: 'Turmas',   icon: 'school-outline' as const },
  { key: 'calendario',label: 'Calendario', icon: 'calendar-outline' as const },
  { key: 'reservas',  label: 'Reservas', icon: 'calendar-outline' as const },
  { key: 'chaves',    label: 'Chaves',   icon: 'key-outline' as const },
];

const matchBusca = (busca: string, ...valores: Array<string | number | null | undefined>) => {
  const q = busca.trim().toLowerCase();
  if (!q) return true;
  return valores.some(v => String(v ?? '').toLowerCase().includes(q));
};

export default function AdminPanel() {
  const { sessao, pronto } = useRequirePerfil('admin');
  const { sair } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  const recarregar = useCallback(async () => {
    setRefreshing(true);
    console.log('Recarregando dados...');
    await db.initDados(true);
    console.log('Dados recarregados, atualizando UI...');
    setTick(t => t + 1);
    setRefreshing(false);
  }, []);

  if (!pronto) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const meta: Record<string, { t: string; s: string }> = {
    dashboard: { t: 'Painel', s: 'Visao geral do sistema' },
    usuarios:  { t: 'Usuarios', s: 'Coordenadores, instrutores e recepcao' },
    unidades:  { t: 'Unidades', s: 'Unidades do SENAC no GDF' },
    salas:     { t: 'Salas', s: 'Todas as salas do sistema' },
    turmas:    { t: 'Turmas', s: 'Todas as turmas do sistema' },
    calendario:{ t: 'Calendario', s: 'Agenda de reservas do sistema' },
    reservas:  { t: 'Reservas', s: 'Todas as reservas do sistema' },
    chaves:    { t: 'Chaves', s: 'Todas as chaves do sistema' },
  };

  return (
    <ScreenShell
      sessao={sessao} perfilLabel="Administrador"
      title={meta[tab].t} subtitle={meta[tab].s}
      tabs={TABS} activeTab={tab} onTabChange={setTab}
      onLogout={sair} onRefresh={recarregar} refreshing={refreshing}
    >
      {tab === 'dashboard' && <Dashboard key={`d${tick}`} />}
      {tab === 'usuarios'  && <Usuarios onChange={recarregar} key={`u${tick}`} />}
      {tab === 'unidades'  && <Unidades onChange={recarregar} key={`n${tick}`} />}
      {tab === 'salas'     && <Salas key={`s${tick}`} />}
      {tab === 'turmas'    && <Turmas key={`t${tick}`} />}
      {tab === 'calendario'&& <CalendarioArea sessao={sessao!} key={`ca${tick}`} />}
      {tab === 'reservas'  && <Reservas key={`r${tick}`} />}
      {tab === 'chaves'    && <Chaves key={`c${tick}`} />}
    </ScreenShell>
  );
}

function CalendarioArea({ sessao }: { sessao: Sessao }) {
  return (
    <Calendario
      reservas={db.getReservas()}
      salas={db.getSalas()}
      turmas={db.getTurmas()}
      usuarios={db.getUsuarios()}
      sessao={sessao}
    />
  );
}

// ---- Dashboard ----
function Dashboard() {
  const { pedirConfirmacao } = useConfirmar();
  const stats = [
    { label: 'Usuarios',  valor: db.getUsuarios().length, icon: 'people-outline' as const, tone: 'primary' as const },
    { label: 'Coordenad.',valor: db.getUsersByPerfil('coordenador').length, icon: 'person-circle-outline' as const, tone: 'blue' as const },
    { label: 'Instrutores',valor: db.getUsersByPerfil('instrutor').length, icon: 'school-outline' as const, tone: 'green' as const },
    { label: 'Unidades',  valor: db.getUnidades().length, icon: 'business-outline' as const, tone: 'amber' as const },
    { label: 'Salas',     valor: db.getSalas().length, icon: 'easel-outline' as const, tone: 'primary' as const },
    { label: 'Turmas',    valor: db.getTurmas().length, icon: 'library-outline' as const, tone: 'blue' as const },
    { label: 'Reservas',  valor: db.getReservas().length, icon: 'calendar-outline' as const, tone: 'green' as const },
    { label: 'Chaves',    valor: db.getChaves().length, icon: 'key-outline' as const, tone: 'amber' as const },
  ];

  const resetar = async () => {
    const ok = await pedirConfirmacao({
      titulo: 'Resetar',
      msg: 'Isso apagara tudo e recarregara os dados de exemplo. Continuar?',
      confirmar: 'Resetar',
      destrutivo: true,
    });
    if (ok) await db.resetarTudo();
  };

  return (
    <View>
      <View style={styles.statsGrid}>
        {stats.map(s => (
          <StatCard key={s.label} label={s.label} value={s.valor} icon={s.icon} tone={s.tone} />
        ))}
      </View>
      <Button title="Resetar dados de exemplo" variant="ghost" icon="refresh-outline" onPress={resetar} />
    </View>
  );
}

// ---- Usuarios ----
function Usuarios({ onChange }: { onChange: () => void }) {
  const [busca, setBusca] = useState('');
  const list = db.getUsuarios().filter(u => {
    const unid = db.getUnidadeById(u.unidadeId);
    return u.perfil !== 'admin' && matchBusca(busca, u.nome, u.email, u.perfil, unid?.nome);
  });
  const [modal, setModal] = useState<Usuario | 'novo' | null>(null);
  const { pedirConfirmacao } = useConfirmar();

  const excluir = async (u: Usuario) => {
    const ok = await pedirConfirmacao({
      titulo: 'Excluir',
      msg: `Excluir ${u.nome}?`,
      confirmar: 'Excluir',
      destrutivo: true,
    });
    if (!ok) return;
    try {
      console.log('Iniciando deleção de usuário:', u.id, u.nome);
      await db.delUser(u.id);
      console.log('Usuário deletado com sucesso');
      Alert.alert('Sucesso', `${u.nome} foi excluído.`);
      onChange();
    } catch (err) {
      console.error('Erro ao deletar usuário:', err);
      Alert.alert('Erro', `Falha ao excluir usuário: ${err}`);
    }
  };

  const tone: Record<string, 'blue' | 'green' | 'amber'> = { coordenador: 'blue', instrutor: 'green', recepcao: 'amber' };

  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar usuarios" />
      <Button title="Novo usuario" variant="primary" icon="add" onPress={() => setModal('novo')} style={{ marginBottom: 14 }} />
      {list.map(u => {
        const unid = db.getUnidadeById(u.unidadeId);
        return (
          <Card key={u.id} style={{ marginBottom: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.nome}>{u.nome}</Text>
              <Badge label={u.perfil} tone={tone[u.perfil] ?? 'muted'} />
            </View>
            <Text style={styles.sub}>{u.email}</Text>
            <Text style={styles.sub}>{unid?.nome ?? '-'}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Button title="Editar" variant="ghost" size="sm" icon="create-outline" onPress={() => setModal(u)} />
              <Button title="Excluir" variant="danger" size="sm" icon="trash-outline" onPress={() => excluir(u)} />
            </View>
          </Card>
        );
      })}
      {!list.length && <EmptyState icon="people-outline" text="Nenhum usuario." />}
      {modal && <ModalUsuario user={modal === 'novo' ? null : modal} onClose={() => setModal(null)} onDone={() => { setModal(null); onChange(); }} />}
    </View>
  );
}

function ModalUsuario({ user, onClose, onDone }: { user: Usuario | null; onClose: () => void; onDone: () => void }) {
  const [nome, setNome] = useState(user?.nome ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [senha, setSenha] = useState('');
  const [perfil, setPerfil] = useState<Perfil>(user?.perfil ?? 'instrutor');
  const [unidadeId, setUnidadeId] = useState<number>(user?.unidadeId ?? db.getUnidades()[0]?.id ?? 0);
  const unidades = db.getUnidades();

  const salvar = async () => {
    if (!nome || !email) { Alert.alert('Atencao', 'Preencha nome e e-mail.'); return; }
    if (!user && !senha) { Alert.alert('Atencao', 'Informe a senha.'); return; }
    if (user) {
      await db.updUser(user.id, { nome, email, perfil, unidadeId, ...(senha ? { senha } : {}) });
    } else {
      await db.addUser({ nome, email, senha, perfil, unidadeId });
    }
    onDone();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{user ? 'Editar' : 'Novo'} Usuario</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.text2} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 440 }}>
            <Text style={styles.mLabel}>Nome</Text>
            <TextInput style={styles.mInput} value={nome} onChangeText={setNome} placeholderTextColor={Colors.text3} />
            <Text style={styles.mLabel}>E-mail</Text>
            <TextInput style={styles.mInput} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={Colors.text3} />
            <Text style={styles.mLabel}>Senha {user ? '(deixe vazio para manter)' : ''}</Text>
            <TextInput style={styles.mInput} value={senha} onChangeText={setSenha} secureTextEntry placeholderTextColor={Colors.text3} />
            <Text style={styles.mLabel}>Perfil</Text>
            <View style={styles.chipsRow}>
              {(['coordenador', 'instrutor', 'recepcao'] as Perfil[]).map(p => (
                <TouchableOpacity key={p} style={[styles.chip, perfil === p && styles.chipActive]} onPress={() => setPerfil(p)}>
                  <Text style={[styles.chipTxt, perfil === p && styles.chipTxtActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.mLabel}>Unidade</Text>
            <View style={styles.chipsRow}>
              {unidades.map(u => (
                <TouchableOpacity key={u.id} style={[styles.chip, unidadeId === u.id && styles.chipActive]} onPress={() => setUnidadeId(u.id)}>
                  <Text style={[styles.chipTxt, unidadeId === u.id && styles.chipTxtActive]}>{u.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <Button title="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Salvar" variant="primary" icon="checkmark" onPress={salvar} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---- Unidades ----
function Unidades({ onChange }: { onChange: () => void }) {
  const [busca, setBusca] = useState('');
  const list = db.getUnidades().filter(u => matchBusca(busca, u.nome, u.cep, u.cidade, u.endereco));
  const [modal, setModal] = useState<Unidade | 'novo' | null>(null);
  const { pedirConfirmacao } = useConfirmar();

  const excluir = async (u: Unidade) => {
    const ok = await pedirConfirmacao({
      titulo: 'Excluir',
      msg: `Excluir ${u.nome}?`,
      confirmar: 'Excluir',
      destrutivo: true,
    });
    if (!ok) return;
    try {
      console.log('Iniciando deleção de unidade:', u.id, u.nome);
      await db.delUnidade(u.id);
      console.log('Unidade deletada com sucesso');
      Alert.alert('Sucesso', `${u.nome} foi excluída.`);
      onChange();
    } catch (err) {
      console.error('Erro ao deletar unidade:', err);
      Alert.alert('Erro', `Falha ao excluir unidade: ${err}`);
    }
  };

  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar unidades" />
      <Button title="Nova unidade" variant="primary" icon="add" onPress={() => setModal('novo')} style={{ marginBottom: 14 }} />
      {list.map(u => (
        <Card key={u.id} style={{ marginBottom: 10 }}>
          <Text style={styles.nome}>{u.nome}</Text>
          <Text style={styles.sub}>{u.cep} · {u.cidade}</Text>
          <Text style={styles.sub}>{u.endereco}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Button title="Editar" variant="ghost" size="sm" icon="create-outline" onPress={() => setModal(u)} />
            <Button title="Excluir" variant="danger" size="sm" icon="trash-outline" onPress={() => excluir(u)} />
          </View>
        </Card>
      ))}
      {modal && <ModalUnidade unidade={modal === 'novo' ? null : modal} onClose={() => setModal(null)} onDone={() => { setModal(null); onChange(); }} />}
    </View>
  );
}

function ModalUnidade({ unidade, onClose, onDone }: { unidade: Unidade | null; onClose: () => void; onDone: () => void }) {
  const [nome, setNome] = useState(unidade?.nome ?? '');
  const [cep, setCep] = useState(unidade?.cep ?? '');
  const [cidade, setCidade] = useState(unidade?.cidade ?? '');
  const [endereco, setEndereco] = useState(unidade?.endereco ?? '');
  const salvar = async () => {
    if (!nome) { Alert.alert('Atencao', 'Informe o nome.'); return; }
    if (unidade) await db.updUnidade(unidade.id, { nome, cep, cidade, endereco });
    else await db.addUnidade({ nome, cep, cidade, endereco });
    onDone();
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{unidade ? 'Editar' : 'Nova'} Unidade</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.text2} /></TouchableOpacity>
          </View>
          <Text style={styles.mLabel}>Nome</Text>
          <TextInput style={styles.mInput} value={nome} onChangeText={setNome} placeholderTextColor={Colors.text3} />
          <Text style={styles.mLabel}>CEP</Text>
          <TextInput style={styles.mInput} value={cep} onChangeText={setCep} placeholderTextColor={Colors.text3} />
          <Text style={styles.mLabel}>Cidade</Text>
          <TextInput style={styles.mInput} value={cidade} onChangeText={setCidade} placeholderTextColor={Colors.text3} />
          <Text style={styles.mLabel}>Endereco</Text>
          <TextInput style={styles.mInput} value={endereco} onChangeText={setEndereco} placeholderTextColor={Colors.text3} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Button title="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Salvar" variant="primary" icon="checkmark" onPress={salvar} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---- Salas (leitura) ----
function Salas() {
  const [busca, setBusca] = useState('');
  const list = db.getSalas().filter(s => {
    const u = db.getUnidadeById(s.unidadeId);
    return matchBusca(busca, s.nome, s.tipo, s.andar, s.bloco, s.capacidade, u?.nome, s.turnosDisponiveis.join(' '));
  });
  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar salas" />
      {list.map(s => {
        const u = db.getUnidadeById(s.unidadeId);
        return (
          <Card key={s.id} style={{ marginBottom: 10 }}>
            <Text style={styles.nome}>{s.nome}</Text>
            <Text style={styles.sub}>{s.tipo} · {u?.nome}</Text>
            <Text style={styles.sub}>{s.andar} · {s.bloco} · {s.capacidade} lugares</Text>
            <View style={{ flexDirection: 'row', gap: 5, marginTop: 8 }}>
              {s.turnosDisponiveis.map(t => <Badge key={t} label={t} tone="primary" />)}
            </View>
          </Card>
        );
      })}
      {!list.length && <EmptyState icon="easel-outline" text="Nenhuma sala encontrada." />}
    </View>
  );
}

// ---- Turmas (leitura) ----
function Turmas() {
  const [busca, setBusca] = useState('');
  const list = db.getTurmas().filter(t => {
    const u = db.getUnidadeById(t.unidadeId);
    const inst = t.instrutorId ? db.getUserById(t.instrutorId) : null;
    return matchBusca(busca, t.nome, t.codigo, t.curso, t.turno, t.dataInicio, t.dataFim, inst?.nome, u?.nome, db.calcStatus(t));
  });
  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar turmas" />
      {list.map(t => {
        const u = db.getUnidadeById(t.unidadeId);
        const inst = t.instrutorId ? db.getUserById(t.instrutorId) : null;
        return (
          <Card key={t.id} style={{ marginBottom: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.nome}>{t.nome}</Text>
              <StatusPill status={db.calcStatus(t)} />
            </View>
            <Text style={styles.sub}>{t.curso}</Text>
            <Text style={styles.sub}>{inst?.nome ?? '-'} · {u?.nome}</Text>
          </Card>
        );
      })}
      {!list.length && <EmptyState icon="school-outline" text="Nenhuma turma encontrada." />}
    </View>
  );
}

// ---- Reservas (leitura) ----
function Reservas() {
  const [busca, setBusca] = useState('');
  const list = db.getReservas().filter(r => {
    const sala = db.getSalaById(r.salaId);
    const turma = r.turmaId ? db.getTurmaById(r.turmaId) : null;
    const u = db.getUnidadeById(r.unidadeId);
    const inst = r.instrutorId ? db.getUserById(r.instrutorId) : null;
    return matchBusca(busca, sala?.nome, turma?.nome, inst?.nome, r.turno, r.diasSemana.join(' '), r.dataInicio, r.dataFim, u?.nome, r.avulsa ? 'sem turma avulsa' : '');
  });
  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar reservas" />
      {list.map(r => {
        const sala = db.getSalaById(r.salaId);
        const turma = r.turmaId ? db.getTurmaById(r.turmaId) : null;
        const u = db.getUnidadeById(r.unidadeId);
        return (
          <Card key={r.id} style={{ marginBottom: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.nome}>{sala?.nome ?? '-'}</Text>
              <Badge label={r.turno} tone="primary" />
            </View>
            {r.avulsa || !turma ? <Badge label="Sem turma" tone="amber" style={{ marginTop: 6 }} /> : <Text style={styles.sub}>{turma.nome}</Text>}
            <Text style={styles.sub}>{db.fmtDiasSemana(r.diasSemana)}</Text>
            <Text style={styles.sub}>{db.fmtData(r.dataInicio)} a {db.fmtData(r.dataFim)} · {u?.nome}</Text>
          </Card>
        );
      })}
      {!list.length && <EmptyState icon="calendar-outline" text="Nenhuma reserva encontrada." />}
    </View>
  );
}

// ---- Chaves (leitura) ----
function Chaves() {
  const [busca, setBusca] = useState('');
  const list = db.getChaves().filter(c => {
    const sala = db.getSalaById(c.salaId);
    const u = db.getUnidadeById(c.unidadeId);
    const resp = c.instrutorId ? db.getUserById(c.instrutorId) : null;
    return matchBusca(busca, c.codigo, c.andar, c.status, sala?.nome, u?.nome, resp?.nome);
  });
  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar chaves" />
      {list.map(c => {
        const sala = db.getSalaById(c.salaId);
        const u = db.getUnidadeById(c.unidadeId);
        const pega = c.status === 'pega';
        return (
          <Card key={c.id} style={{ marginBottom: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.nome}>{c.codigo} — {sala?.nome ?? '-'}</Text>
              <Badge label={pega ? 'Com responsavel' : 'Na recepcao'} tone={pega ? 'red' : 'green'} />
            </View>
            <Text style={styles.sub}>{c.andar} · {u?.nome}</Text>
          </Card>
        );
      })}
      {!list.length && <EmptyState icon="key-outline" text="Nenhuma chave encontrada." />}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nome: { fontSize: 15, fontWeight: '800', color: Colors.text, flex: 1 },
  sub: { fontSize: 12, color: Colors.text3, marginTop: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  mLabel: { fontSize: 12, fontWeight: '700', color: Colors.text2, marginBottom: 5, marginTop: 12 },
  mInput: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { fontSize: 12, fontWeight: '600', color: Colors.text2 },
  chipTxtActive: { color: '#fff' },
});
