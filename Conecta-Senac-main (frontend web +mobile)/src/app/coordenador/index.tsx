import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, TouchableOpacity,
  TextInput, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useRequirePerfil, useAuth } from '@/hooks/useAuth';
import { ScreenShell } from '@/components/ScreenShell';
import { SalaCard } from '@/components/SalaCard';
import { Card, Badge, StatusPill, Button, EmptyState, SearchBar, StatCard } from '@/components/ui';
import { useConfirmar } from '@/components/ConfirmProvider';
import Calendario from '@/components/Calendario';
import DatePickerField from '@/components/DatePickerField';
import TimePickerField from '@/components/TimePickerField';
import { calcSalaInfo } from '@/utils/salaStatus';
import * as db from '@/services/storage';
import { Sala, Reserva, Solicitacao, Notificacao, Sessao, Turma, DiaSemana, Turno } from '@/types';

const TABS = [
  { key: 'dashboard',    label: 'Painel',        icon: 'grid-outline' as const },
  { key: 'salas',        label: 'Salas',         icon: 'easel-outline' as const },
  { key: 'turmas',       label: 'Turmas',        icon: 'school-outline' as const },
  { key: 'instrutores',  label: 'Instrutores',   icon: 'people-outline' as const },
  { key: 'mapa',         label: 'Mapa',          icon: 'map-outline' as const },
  { key: 'calendario',   label: 'Calendario',    icon: 'calendar-outline' as const },
  { key: 'reservas',     label: 'Reservas',      icon: 'calendar-outline' as const },
  { key: 'solicitacoes', label: 'Solicitacoes',  icon: 'clipboard-outline' as const },
  { key: 'notifs',       label: 'Avisos',        icon: 'notifications-outline' as const },
];

const matchBusca = (busca: string, ...valores: Array<string | number | null | undefined>) => {
  const q = busca.trim().toLowerCase();
  if (!q) return true;
  return valores.some(v => String(v ?? '').toLowerCase().includes(q));
};

export default function CoordenadorPanel() {
  const { sessao, pronto } = useRequirePerfil('coordenador');
  const { sair } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  const uid = sessao?.unidadeId ?? null;
  const recarregar = useCallback(async () => {
    setRefreshing(true);
    await db.initDados(true);
    setTick(t => t + 1);
    setRefreshing(false);
  }, []);

  const pendentes = pronto ? db.getSolics().filter(s => s.unidadeId === uid && s.status === 'pendente').length : 0;
  const naoLidas  = pronto ? db.countNaoLidas('coordenador', uid) : 0;

  const tabs = TABS.map(t => ({
    ...t,
    badge: t.key === 'solicitacoes' ? pendentes : t.key === 'notifs' ? naoLidas : undefined,
  }));

  if (!pronto) return <Loading />;

  const meta: Record<string, { t: string; s: string }> = {
    dashboard:    { t: 'Painel', s: 'Visao geral da unidade' },
    salas:        { t: 'Salas', s: 'Cadastre e gerencie as salas' },
    turmas:       { t: 'Turmas', s: 'Cadastre e gerencie as turmas' },
    instrutores:  { t: 'Instrutores', s: 'Instrutores da unidade' },
    mapa:         { t: 'Mapa de Salas', s: 'Ocupacao atual das salas' },
    calendario:   { t: 'Calendario', s: 'Agenda de reservas da unidade' },
    reservas:     { t: 'Reservas', s: 'Reservas recorrentes de salas' },
    solicitacoes: { t: 'Solicitacoes', s: 'Pedidos de sala dos instrutores' },
    notifs:       { t: 'Notificacoes', s: 'Avisos recebidos' },
  };

  return (
    <ScreenShell
      sessao={sessao} perfilLabel="Coordenador"
      title={meta[tab].t} subtitle={meta[tab].s}
      tabs={tabs} activeTab={tab} onTabChange={setTab}
      onLogout={sair} onRefresh={recarregar} refreshing={refreshing}
    >
      {tab === 'dashboard'    && <Dashboard uid={uid} key={`d${tick}`} />}
      {tab === 'salas'        && <Salas uid={uid} onChange={recarregar} key={`s${tick}`} />}
      {tab === 'turmas'       && <Turmas uid={uid} onChange={recarregar} key={`t${tick}`} />}
      {tab === 'instrutores'  && <Instrutores uid={uid} onChange={recarregar} key={`i${tick}`} />}
      {tab === 'mapa'         && <Mapa uid={uid} key={`m${tick}`} />}
      {tab === 'calendario'   && <CalendarioArea sessao={sessao!} key={`ca${tick}`} />}
      {tab === 'reservas'     && <Reservas uid={uid} sessaoId={sessao!.id} onChange={recarregar} key={`r${tick}`} />}
      {tab === 'solicitacoes' && <Solicitacoes uid={uid} sessaoId={sessao!.id} onChange={recarregar} key={`so${tick}`} />}
      {tab === 'notifs'       && <Notificacoes uid={uid} key={`n${tick}`} />}
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

function Loading() {
  return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;
}

// ---- Dashboard ----
function Dashboard({ uid }: { uid: number | null }) {
  const salas  = db.getSalasByUnidade(uid);
  const turmas = db.getTurmas().filter(t => t.unidadeId === uid);
  const res    = db.getReservas().filter(r => r.unidadeId === uid);
  const solic  = db.getSolics().filter(s => s.unidadeId === uid && s.status === 'pendente');
  const ativas = turmas.filter(t => db.calcStatus(t) === 'ativa').length;

  const stats = [
    { label: 'Salas',           valor: salas.length, icon: 'business-outline' as const, tone: 'primary' as const },
    { label: 'Turmas ativas',   valor: ativas,       icon: 'school-outline' as const, tone: 'green' as const },
    { label: 'Reservas',        valor: res.length,   icon: 'calendar-outline' as const, tone: 'blue' as const },
    { label: 'Solic. pendentes',valor: solic.length, icon: 'clipboard-outline' as const, tone: solic.length ? 'amber' as const : 'primary' as const },
  ];

  return (
    <View>
      <View style={styles.statsGrid}>
        {stats.map(s => (
          <StatCard key={s.label} label={s.label} value={s.valor} icon={s.icon} tone={s.tone} />
        ))}
      </View>

      <Text style={styles.blockTitle}>Turmas recentes</Text>
      {turmas.slice(0, 6).map(t => {
        const inst = t.instrutorId ? db.getUserById(t.instrutorId) : null;
        return (
          <Card key={t.id} style={{ marginBottom: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.turmaCodigo}>{t.nome}</Text>
              <StatusPill status={db.calcStatus(t)} />
            </View>
            <Text style={styles.turmaCurso}>{t.curso}</Text>
            <Text style={styles.turmaMeta}>{inst?.nome ?? '-'} · {db.fmtData(t.dataInicio)} a {db.fmtData(t.dataFim)}</Text>
          </Card>
        );
      })}
      {!turmas.length && <EmptyState icon="school-outline" text="Nenhuma turma cadastrada." />}
    </View>
  );
}

// ======================= CRUD SALAS =======================
const TURNOS_DISPONIVEIS: Turno[] = ['Matutino', 'Vespertino', 'Noturno'];

function Salas({ uid, onChange }: { uid: number | null; onChange: () => void }) {
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState<Sala | 'novo' | null>(null);
  const { pedirConfirmacao } = useConfirmar();

  const list = db.getSalasByUnidade(uid).filter(s =>
    matchBusca(busca, s.nome, s.tipo, s.andar, s.bloco, s.capacidade, s.turnosDisponiveis.join(' '))
  );

  const excluir = async (s: Sala) => {
    const nr = db.getReservas().filter(r => r.salaId === s.id).length;
    if (nr > 0) {
      await pedirConfirmacao({
        titulo: 'Impossivel excluir',
        msg: `A sala "${s.nome}" tem ${nr} reserva(s). Remova-as primeiro.`,
        confirmar: 'OK',
        cancelar: 'Fechar',
      });
      return;
    }
    const ok = await pedirConfirmacao({
      titulo: 'Excluir sala',
      msg: `Excluir "${s.nome}"?`,
      confirmar: 'Excluir',
      destrutivo: true,
    });
    if (!ok) return;
    await db.delSala(s.id);
    onChange();
  };

  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar salas" />
      <Button title="Nova sala" variant="primary" icon="add" onPress={() => setModal('novo')} style={{ marginBottom: 14 }} />
      {list.map(s => (
        <Card key={s.id} style={{ marginBottom: 10 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.salaNome}>{s.nome}</Text>
            <Badge label={s.tipo} tone="blue" />
          </View>
          <Text style={styles.turmaMeta}>{s.andar} · {s.bloco} · {s.capacidade} lugares</Text>
          <View style={{ flexDirection: 'row', gap: 5, marginTop: 8 }}>
            {s.turnosDisponiveis.map(t => <Badge key={t} label={t} tone="primary" />)}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Button title="Editar" variant="ghost" size="sm" icon="create-outline" onPress={() => setModal(s)} />
            <Button title="Excluir" variant="danger" size="sm" icon="trash-outline" onPress={() => excluir(s)} />
          </View>
        </Card>
      ))}
      {!list.length && <EmptyState icon="easel-outline" text="Nenhuma sala encontrada." />}
      {modal && <ModalSala sala={modal === 'novo' ? null : modal} uid={uid} onClose={() => setModal(null)} onDone={() => { setModal(null); onChange(); }} />}
    </View>
  );
}

function ModalSala({ sala, uid, onClose, onDone }: { sala: Sala | null; uid: number | null; onClose: () => void; onDone: () => void }) {
  const [nome, setNome] = useState(sala?.nome ?? '');
  const [capacidade, setCapacidade] = useState(sala ? String(sala.capacidade) : '');
  const [tipo, setTipo] = useState(sala?.tipo ?? '');
  const [andar, setAndar] = useState(sala?.andar ?? '');
  const [bloco, setBloco] = useState(sala?.bloco ?? '');
  const [turnos, setTurnos] = useState<Turno[]>(sala?.turnosDisponiveis ?? []);

  const toggleTurno = (t: Turno) => setTurnos(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  const salvar = async () => {
    if (!nome.trim() || !capacidade || !tipo.trim()) {
      Alert.alert('Atencao', 'Preencha nome, capacidade e tipo.');
      return;
    }
    if (!turnos.length) {
      Alert.alert('Atencao', 'Selecione ao menos um turno disponivel.');
      return;
    }
    const dados = {
      nome: nome.trim(), capacidade: parseInt(capacidade, 10), tipo: tipo.trim(),
      andar: andar.trim(), bloco: bloco.trim(), turnosDisponiveis: turnos, unidadeId: uid ?? 0,
    };
    if (sala) await db.updSala(sala.id, dados);
    else await db.addSala(dados);
    onDone();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{sala ? 'Editar' : 'Nova'} Sala</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.text2} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 460 }}>
            <Text style={styles.mLabel}>Nome / Numero *</Text>
            <TextInput style={styles.mInput} value={nome} onChangeText={setNome} placeholder="Ex.: Lab 03" placeholderTextColor={Colors.text3} />
            <Text style={styles.mLabel}>Capacidade *</Text>
            <TextInput style={styles.mInput} value={capacidade} onChangeText={setCapacidade} keyboardType="number-pad" placeholder="30" placeholderTextColor={Colors.text3} />
            <Text style={styles.mLabel}>Tipo de Sala *</Text>
            <TextInput style={styles.mInput} value={tipo} onChangeText={setTipo} placeholder="Ex.: Laboratorio de Informatica" placeholderTextColor={Colors.text3} />
            <Text style={styles.mLabel}>Andar</Text>
            <TextInput style={styles.mInput} value={andar} onChangeText={setAndar} placeholder="Ex.: 1o Andar" placeholderTextColor={Colors.text3} />
            <Text style={styles.mLabel}>Bloco</Text>
            <TextInput style={styles.mInput} value={bloco} onChangeText={setBloco} placeholder="Ex.: Bloco A" placeholderTextColor={Colors.text3} />
            <Text style={styles.mLabel}>Turnos disponiveis *</Text>
            <View style={styles.chipsRow}>
              {TURNOS_DISPONIVEIS.map(t => (
                <TouchableOpacity key={t} style={[styles.chip, turnos.includes(t) && styles.chipActive]} onPress={() => toggleTurno(t)}>
                  <Text style={[styles.chipTxt, turnos.includes(t) && styles.chipTxtActive]}>{t}</Text>
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

// ======================= CRUD TURMAS =======================
function Turmas({ uid, onChange }: { uid: number | null; onChange: () => void }) {
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState<Turma | 'novo' | null>(null);
  const { pedirConfirmacao } = useConfirmar();

  const list = db.getTurmas()
    .filter(t => t.unidadeId === uid)
    .filter(t => {
      const inst = t.instrutorId ? db.getUserById(t.instrutorId) : null;
      return matchBusca(busca, t.nome, t.curso, t.turno, inst?.nome, db.calcStatus(t));
    })
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));

  const excluir = async (t: Turma) => {
    const ok = await pedirConfirmacao({
      titulo: 'Excluir turma',
      msg: `Excluir "${t.nome}"? As reservas vinculadas tambem serao removidas.`,
      confirmar: 'Excluir',
      destrutivo: true,
    });
    if (!ok) return;
    await db.delTurma(t.id);
    onChange();
  };

  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar turmas" />
      <Button title="Nova turma" variant="primary" icon="add" onPress={() => setModal('novo')} style={{ marginBottom: 14 }} />
      {list.map(t => {
        const inst = t.instrutorId ? db.getUserById(t.instrutorId) : null;
        return (
          <Card key={t.id} style={{ marginBottom: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.salaNome}>{t.nome}</Text>
              <StatusPill status={db.calcStatus(t)} />
            </View>
            <Text style={styles.turmaCurso}>{t.curso}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center' }}>
              <Badge label={t.turno} tone="primary" />
              <Text style={styles.turmaMeta}>{inst?.nome ?? 'Sem instrutor'}</Text>
            </View>
            <Text style={styles.turmaMeta}>{db.fmtData(t.dataInicio)} a {db.fmtData(t.dataFim)}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Button title="Editar" variant="ghost" size="sm" icon="create-outline" onPress={() => setModal(t)} />
              <Button title="Excluir" variant="danger" size="sm" icon="trash-outline" onPress={() => excluir(t)} />
            </View>
          </Card>
        );
      })}
      {!list.length && <EmptyState icon="school-outline" text="Nenhuma turma encontrada." />}
      {modal && <ModalTurma turma={modal === 'novo' ? null : modal} uid={uid} onClose={() => setModal(null)} onDone={() => { setModal(null); onChange(); }} />}
    </View>
  );
}

function ModalTurma({ turma, uid, onClose, onDone }: { turma: Turma | null; uid: number | null; onClose: () => void; onDone: () => void }) {
  const [codigo, setCodigo] = useState(turma?.nome ?? '');
  const [curso, setCurso] = useState(turma?.curso ?? '');
  const [turno, setTurno] = useState<Turno>(turma?.turno ?? 'Matutino');
  const [ini, setIni] = useState(turma?.dataInicio ?? '');
  const [fim, setFim] = useState(turma?.dataFim ?? '');
  const [instrutorId, setInstrutorId] = useState<number | null>(turma?.instrutorId ?? null);

  const instrutores = db.getUsersByPerfil('instrutor').filter(u => u.unidadeId === uid);

  const salvar = async () => {
    if (!codigo.trim() || !curso.trim() || !ini || !fim) {
      Alert.alert('Atencao', 'Preencha codigo, curso, data de inicio e fim.');
      return;
    }
    if (fim < ini) {
      Alert.alert('Atencao', 'Data fim deve ser posterior ao inicio.');
      return;
    }
    const dados = {
      codigo: codigo.trim(), nome: codigo.trim(), curso: curso.trim(), turno,
      dataInicio: ini, dataFim: fim, instrutorId, unidadeId: uid ?? 0,
    };
    if (turma) await db.updTurma(turma.id, dados);
    else await db.addTurma(dados);
    onDone();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{turma ? 'Editar' : 'Nova'} Turma</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.text2} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 460 }}>
            <Text style={styles.mLabel}>Codigo *</Text>
            <TextInput style={styles.mInput} value={codigo} onChangeText={setCodigo} placeholder="2025.08.178" placeholderTextColor={Colors.text3} />
            <Text style={styles.mLabel}>Curso *</Text>
            <TextInput style={styles.mInput} value={curso} onChangeText={setCurso} placeholder="Nome do curso" placeholderTextColor={Colors.text3} />
            <Text style={styles.mLabel}>Turno *</Text>
            <View style={styles.chipsRow}>
              {TURNOS_DISPONIVEIS.map(t => (
                <TouchableOpacity key={t} style={[styles.chip, turno === t && styles.chipActive]} onPress={() => setTurno(t)}>
                  <Text style={[styles.chipTxt, turno === t && styles.chipTxtActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.mLabel}>Instrutor</Text>
            <View style={styles.chipsRow}>
              <TouchableOpacity style={[styles.chip, instrutorId === null && styles.chipActive]} onPress={() => setInstrutorId(null)}>
                <Text style={[styles.chipTxt, instrutorId === null && styles.chipTxtActive]}>Sem instrutor</Text>
              </TouchableOpacity>
              {instrutores.map(i => (
                <TouchableOpacity key={i.id} style={[styles.chip, instrutorId === i.id && styles.chipActive]} onPress={() => setInstrutorId(i.id)}>
                  <Text style={[styles.chipTxt, instrutorId === i.id && styles.chipTxtActive]}>{i.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mLabel}>Data inicio *</Text>
                <DatePickerField value={ini} onChange={setIni} placeholder="Selecionar inicio" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mLabel}>Data fim *</Text>
                <DatePickerField value={fim} onChange={setFim} placeholder="Selecionar fim" minDate={ini || undefined} />
              </View>
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

// ======================= INSTRUTORES (listar + atribuir turmas) =======================
function Instrutores({ uid, onChange }: { uid: number | null; onChange: () => void }) {
  const [busca, setBusca] = useState('');
  const [atribuirPara, setAtribuirPara] = useState<number | null>(null);

  const list = db.getUsersByPerfil('instrutor')
    .filter(u => u.unidadeId === uid)
    .filter(u => matchBusca(busca, u.nome, u.email));

  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar instrutores" />
      {list.map(u => {
        const turmas = db.getTurmas().filter(t => t.instrutorId === u.id && t.unidadeId === uid);
        return (
          <Card key={u.id} style={{ marginBottom: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.salaNome}>{u.nome}</Text>
              <Badge label="Instrutor" tone="green" />
            </View>
            <Text style={styles.turmaMeta}>{u.email}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
              {turmas.length ? turmas.map(t => (
                <View key={t.id} style={styles.miniStatus}>
                  <Text style={styles.miniStatusTxt}>{t.nome} · {db.calcStatus(t)}</Text>
                </View>
              )) : <Text style={styles.turmaMeta}>Nenhuma turma atribuida</Text>}
            </View>
            <Button title="Atribuir Turmas" variant="ghost" size="sm" icon="git-branch-outline"
              onPress={() => setAtribuirPara(u.id)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
          </Card>
        );
      })}
      {!list.length && <EmptyState icon="people-outline" text="Nenhum instrutor encontrado." />}

      {atribuirPara !== null && (
        <ModalAtribuirTurmas instrutorId={atribuirPara} uid={uid}
          onClose={() => setAtribuirPara(null)}
          onDone={() => { setAtribuirPara(null); onChange(); }} />
      )}
    </View>
  );
}

function ModalAtribuirTurmas({ instrutorId, uid, onClose, onDone }: { instrutorId: number; uid: number | null; onClose: () => void; onDone: () => void }) {
  const instrutor = db.getUserById(instrutorId);
  const turmas = db.getTurmas().filter(t => t.unidadeId === uid).sort((a, b) => a.nome.localeCompare(b.nome));
  const [selecionadas, setSelecionadas] = useState<number[]>(
    turmas.filter(t => t.instrutorId === instrutorId).map(t => t.id)
  );

  const toggle = (id: number) =>
    setSelecionadas(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const salvar = async () => {
    if (!selecionadas.length) {
      Alert.alert('Atencao', 'Selecione ao menos uma turma.');
      return;
    }
    for (const tid of selecionadas) {
      await db.updTurma(tid, { instrutorId });
    }
    onDone();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Atribuir turmas a {instrutor?.nome ?? 'instrutor'}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.text2} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 420 }}>
            {turmas.length ? turmas.map(t => {
              const atual = t.instrutorId ? db.getUserById(t.instrutorId) : null;
              return (
                <TouchableOpacity key={t.id} style={[styles.turmaCheck, selecionadas.includes(t.id) && styles.turmaCheckAtivo]}
                  onPress={() => toggle(t.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.turmaCheckNome}>{t.nome}</Text>
                    <Text style={styles.turmaMeta}>{t.curso} · {t.turno}</Text>
                    <Text style={styles.turmaMeta}>
                      {atual ? (t.instrutorId === instrutorId ? 'Ja atribuida a este instrutor' : `Atual: ${atual.nome}`) : 'Sem instrutor'}
                    </Text>
                  </View>
                  {selecionadas.includes(t.id) && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
                </TouchableOpacity>
              );
            }) : <EmptyState icon="school-outline" text="Nenhuma turma cadastrada." />}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <Button title="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Atribuir" variant="primary" icon="checkmark" onPress={salvar} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---- Mapa (filtros + override manual + proximas reservas 14 dias) ----
type FiltroMapa = { bloco: string; andar: string; turno: string; status: string };

function Mapa({ uid }: { uid: number | null }) {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroMapa>({ bloco: '', andar: '', turno: '', status: '' });
  const [tick, setTick] = useState(0);
  const hoje = db.hojeISO();

  const salasUnidade = useMemo(() => db.getSalasByUnidade(uid), [uid]);
  const blocos = useMemo(() => Array.from(new Set(salasUnidade.map(s => s.bloco).filter(Boolean))).sort(), [salasUnidade]);
  const andares = useMemo(() => Array.from(new Set(salasUnidade.map(s => s.andar).filter(Boolean))).sort(), [salasUnidade]);

  const infos = useMemo(() => {
    return salasUnidade
      .filter(s => matchBusca(busca, s.nome, s.tipo, s.andar, s.bloco, s.capacidade, s.turnosDisponiveis.join(' ')))
      .filter(s => !filtro.bloco || s.bloco === filtro.bloco)
      .filter(s => !filtro.andar || s.andar === filtro.andar)
      .filter(s => !filtro.turno || s.turnosDisponiveis.includes(filtro.turno as never))
      .map(s => ({ sala: s, info: calcSalaInfo(s, hoje) }))
      .filter(i => !filtro.status || i.info.stat === filtro.status);
  }, [salasUnidade, busca, filtro, hoje]);

  const livres = infos.filter(i => i.info.stat === 'livre').length;
  const ocupadas = infos.filter(i => i.info.stat === 'ocupada').length;
  const iminentes = infos.filter(i => i.info.stat === 'iminente').length;

  const proximas = useMemo(() => {
    const fim = new Date();
    fim.setDate(fim.getDate() + 14);
    const fimISO = fim.toISOString().split('T')[0];
    return db.getReservas()
      .filter(r => r.unidadeId === uid && r.dataInicio <= fimISO && r.dataFim >= hoje)
      .sort((a, b) => (a.dataInicio ?? '').localeCompare(b.dataInicio ?? ''));
  }, [uid, hoje]);

  const setF = (campo: keyof FiltroMapa, valor: string) =>
    setFiltro(prev => ({ ...prev, [campo]: prev[campo] === valor ? '' : valor }));

  const renderFiltro = (campo: keyof FiltroMapa, valores: string[], placeholder: string) => (
    <View style={styles.filtroRow}>
      <Text style={styles.filtroLabel}>{placeholder}</Text>
      <ScrollFiltros>
        {valores.map(v => {
          const ativo = filtro[campo] === v;
          return (
            <TouchableOpacity
              key={v}
              style={[styles.filtroChip, ativo && styles.filtroChipAtivo]}
              onPress={() => setF(campo, v)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filtroChipTxt, ativo && styles.filtroChipTxtAtivo]} numberOfLines={1}>{v}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollFiltros>
    </View>
  );

  const setOverride = async (sala: Sala, status: 'ocupada' | 'iminente' | 'livre') => {
    if (status === 'ocupada' || status === 'iminente') {
      // Usamos um modal simples com prompt: o web usa prompt() — aqui perguntamos via dialog
      Alert.alert(
        status === 'ocupada' ? 'Marcar como Ocupada' : 'Marcar como Em Breve',
        'Registrar o motivo?',
        [
          { text: 'Sem motivo', onPress: () => applyOverride(sala.id, status, 'Status manual') },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
    } else {
      await applyOverride(sala.id, 'livre', '');
    }
  };

  const applyOverride = async (salaId: number, status: string, motivo: string) => {
    await db.updSala(salaId, {
      statusManual: status === 'livre' ? null : status,
      motivoManual: status === 'livre' ? '' : motivo,
      manualPor: status === 'livre' ? '' : 'Coordenador',
      manualCriadaEm: status === 'livre' ? null : new Date().toISOString(),
    });
    setTick(t => t + 1);
  };

  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar sala…" />

      {renderFiltro('bloco', blocos, 'Bloco')}
      {renderFiltro('andar', andares, 'Andar')}
      {renderFiltro('turno', ['Matutino', 'Vespertino', 'Noturno'], 'Turno')}
      {renderFiltro('status', ['livre', 'ocupada', 'iminente'], 'Status')}

      <View style={styles.legenda}>
        <View style={styles.legItem}><View style={[styles.legDot, { backgroundColor: Colors.green }]} /><Text style={styles.legTxt}>Livre: {livres}</Text></View>
        <View style={styles.legItem}><View style={[styles.legDot, { backgroundColor: Colors.red }]} /><Text style={styles.legTxt}>Ocupada: {ocupadas}</Text></View>
        <View style={styles.legItem}><View style={[styles.legDot, { backgroundColor: Colors.amber }]} /><Text style={styles.legTxt}>Em breve: {iminentes}</Text></View>
        <View style={styles.legItem}><Text style={styles.legTotal}>{infos.length} salas</Text></View>
      </View>

      {infos.map(({ sala, info }) => (
        <SalaCardF key={sala.id} sala={sala} info={info} onOverride={setOverride} />
      ))}
      {!infos.length && <EmptyState icon="map-outline" text="Nenhuma sala encontrada." />}

      <Text style={[styles.blockTitle, { marginTop: 24 }]}>Próximas Reservas (14 dias)</Text>
      {proximas.map(r => {
        const sala = db.getSalaById(r.salaId);
        const turma = r.turmaId ? db.getTurmaById(r.turmaId) : null;
        const inst = r.instrutorId ? db.getUserById(r.instrutorId) : (turma?.instrutorId ? db.getUserById(turma.instrutorId) : null);
        return (
          <Card key={r.id} style={{ marginBottom: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.salaNome}>{sala?.nome ?? '-'}</Text>
              <Badge label={r.turno} tone="primary" />
            </View>
            <Text style={styles.turmaCurso}>{r.avulsa || !turma ? 'Sem turma (avulsa)' : `${turma.codigo} · ${turma.curso}`}</Text>
            <Text style={styles.turmaMeta}>
              {inst?.nome ?? '-'} · {db.fmtData(r.dataInicio)} a {db.fmtData(r.dataFim)}
            </Text>
            <Text style={styles.turmaMeta}>{db.fmtDiasSemana(r.diasSemana)}</Text>
          </Card>
        );
      })}
      {!proximas.length && <EmptyState icon="calendar-outline" text="Nenhuma reserva nos proximos 14 dias." />}
    </View>
  );
}

function SalaCardF({ sala, info, onOverride }: {
  sala: Sala;
  info: ReturnType<typeof calcSalaInfo>;
  onOverride: (sala: Sala, status: 'ocupada' | 'iminente' | 'livre') => void;
}) {
  const manual = (sala as unknown as { statusManual?: string | null }).statusManual;
  return (
    <View>
      <SalaCard sala={sala} info={info} />
      {/* Barra de override manual — espelha .sc-override-bar do web */}
      <View style={styles.overrideBar}>
        <TouchableOpacity
          style={[styles.overrideBtn, info.stat === 'ocupada' && styles.overrideAtivo]}
          onPress={() => onOverride(sala, 'ocupada')}
        >
          <View style={[styles.overrideDot, { backgroundColor: Colors.red }]} />
          <Text style={styles.overrideTxt}>Ocupada</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.overrideBtn, info.stat === 'iminente' && styles.overrideAtivo]}
          onPress={() => onOverride(sala, 'iminente')}
        >
          <View style={[styles.overrideDot, { backgroundColor: Colors.amber }]} />
          <Text style={styles.overrideTxt}>Em breve</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.overrideBtn, !manual && info.stat === 'livre' && styles.overrideAtivo]}
          onPress={() => onOverride(sala, 'livre')}
        >
          <View style={[styles.overrideDot, { backgroundColor: Colors.green }]} />
          <Text style={styles.overrideTxt}>Livre</Text>
        </TouchableOpacity>
        {manual ? (
          <TouchableOpacity style={styles.overrideAuto} onPress={() => onOverride(sala, 'livre')}>
            <Ionicons name="refresh-outline" size={14} color={Colors.text2} />
            <Text style={styles.overrideAutoTxt}>Auto</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function ScrollFiltros({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtroChips}>
      {children}
    </ScrollView>
  );
}

// ---- Reservas (CRUD completo com conflito) ----
const DIAS_SEMANA: { v: DiaSemana; l: string }[] = [
  { v: 'seg', l: 'Seg' }, { v: 'ter', l: 'Ter' }, { v: 'qua', l: 'Qua' },
  { v: 'qui', l: 'Qui' }, { v: 'sex', l: 'Sex' }, { v: 'sab', l: 'Sab' },
];

function Reservas({ uid, sessaoId, onChange }: { uid: number | null; sessaoId: number; onChange: () => void }) {
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState<Reserva | 'novo' | null>(null);
  const { pedirConfirmacao } = useConfirmar();
  const list = db.getReservas()
    .filter(r => r.unidadeId === uid)
    .filter(r => {
      const sala  = db.getSalaById(r.salaId);
      const turma = r.turmaId ? db.getTurmaById(r.turmaId) : null;
      const inst  = r.instrutorId ? db.getUserById(r.instrutorId) : (turma?.instrutorId ? db.getUserById(turma.instrutorId) : null);
      return matchBusca(busca, sala?.nome, turma?.nome, inst?.nome, r.turno, r.diasSemana.join(' '), r.dataInicio, r.dataFim, r.horaInicio, r.horaFim);
    })
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));

  const excluir = async (r: Reserva) => {
    const ok = await pedirConfirmacao({
      titulo: 'Excluir reserva',
      msg: 'Tem certeza que deseja excluir esta reserva?',
      confirmar: 'Excluir',
      destrutivo: true,
    });
    if (!ok) return;
    await db.delReserva(r.id);
    onChange();
  };

  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar reservas" />
      <Button title="Nova reserva" variant="primary" icon="add" onPress={() => setModal('novo')} style={{ marginBottom: 14 }} />
      {list.map(r => {
        const sala  = db.getSalaById(r.salaId);
        const turma = r.turmaId ? db.getTurmaById(r.turmaId) : null;
        const inst  = r.instrutorId ? db.getUserById(r.instrutorId) : (turma?.instrutorId ? db.getUserById(turma.instrutorId) : null);
        return (
          <Card key={r.id} style={{ marginBottom: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.salaNome}>{sala?.nome ?? '-'}</Text>
              <Badge label={r.turno} tone="primary" />
            </View>
            <View style={styles.reservaMetaRow}>
              {r.avulsa || !turma
                ? <Badge label="Sem turma" tone="amber" />
                : <Text style={styles.turmaCodigo}>{turma.nome}</Text>}
            </View>
            {inst && <Text style={styles.turmaMeta}>Instrutor: {inst.nome}</Text>}
            <Text style={styles.turmaMeta}>
              {db.fmtDiasSemana(r.diasSemana)}
              {r.horaInicio && r.horaFim ? ` · ${r.horaInicio}-${r.horaFim}` : ''}
            </Text>
            <Text style={styles.turmaMeta}>{db.fmtData(r.dataInicio)} a {db.fmtData(r.dataFim)}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Button title="Editar" variant="ghost" size="sm" icon="create-outline" onPress={() => setModal(r)} />
              <Button title="Excluir" variant="danger" size="sm" icon="trash-outline" onPress={() => excluir(r)} />
            </View>
          </Card>
        );
      })}
      {!list.length && <EmptyState icon="calendar-outline" text="Nenhuma reserva encontrada." />}
      {modal && (
        <ModalReserva
          reserva={modal === 'novo' ? null : modal}
          uid={uid}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); onChange(); }}
        />
      )}
    </View>
  );
}

function ModalReserva({ reserva, uid, onClose, onDone }: {
  reserva: Reserva | null;
  uid: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const salas = db.getSalasByUnidade(uid);
  const turmas = db.getTurmas()
    .filter(t => t.unidadeId === uid && (db.calcStatus(t) !== 'encerrada' || (reserva && reserva.turmaId === t.id)));

  const [salaId, setSalaId] = useState<number | null>(reserva?.salaId ?? null);
  const [turmaId, setTurmaId] = useState<number | null>(reserva?.turmaId ?? null);
  const [turno, setTurno] = useState<Turno>(reserva?.turno ?? 'Matutino');
  const [dias, setDias] = useState<DiaSemana[]>(reserva?.diasSemana ?? []);
  const [ini, setIni] = useState(reserva?.dataInicio ?? '');
  const [fim, setFim] = useState(reserva?.dataFim ?? '');
  const [horaIni, setHoraIni] = useState(reserva?.horaInicio ?? '');
  const [horaFim, setHoraFim] = useState(reserva?.horaFim ?? '');

  const salaSel = salaId ? db.getSalaById(salaId) : null;
  const turnosSala = salaSel?.turnosDisponiveis ?? TURNOS_DISPONIVEIS;

  const toggleDia = (d: DiaSemana) =>
    setDias(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);

  const selecionarTurma = (id: number) => {
    setTurmaId(id);
    const t = db.getTurmaById(id);
    if (t) {
      setTurno(t.turno);
      setIni(t.dataInicio);
      setFim(t.dataFim);
    }
  };

  const salvar = async () => {
    if (!salaId) { Alert.alert('Atencao', 'Selecione uma sala.'); return; }
    if (!turmaId) { Alert.alert('Atencao', 'Selecione uma turma.'); return; }
    if (!dias.length) { Alert.alert('Atencao', 'Selecione ao menos um dia.'); return; }
    if (!ini || !fim) { Alert.alert('Atencao', 'Informe data de inicio e fim.'); return; }

    const turma = db.getTurmaById(turmaId);
    if (turma) {
      if (fim > turma.dataFim) {
        Alert.alert('Atencao', `Data fim (${db.fmtData(fim)}) ultrapassa o fim da turma (${db.fmtData(turma.dataFim)}).`);
        return;
      }
      if (ini < turma.dataInicio) {
        Alert.alert('Atencao', `Data inicio (${db.fmtData(ini)}) e anterior ao inicio da turma (${db.fmtData(turma.dataInicio)}).`);
        return;
      }
    }

    if (salaSel && !salaSel.turnosDisponiveis.includes(turno)) {
      Alert.alert('Atencao', `A sala "${salaSel.nome}" nao tem o turno ${turno} disponivel.`);
      return;
    }

    const dados = {
      salaId, turmaId, turno, diasSemana: dias,
      dataInicio: ini, dataFim: fim,
      horaInicio: horaIni || null, horaFim: horaFim || null,
      instrutorId: turma?.instrutorId ?? null,
      unidadeId: uid ?? 0,
    };

    const conflito = db.verificarConflito(
      { salaId, turno, diasSemana: dias, dataInicio: ini, dataFim: fim },
      reserva?.id ?? null
    );
    if (conflito) {
      Alert.alert('Conflito', conflito);
      return;
    }

    if (reserva) await db.updReserva(reserva.id, dados);
    else await db.addReserva(dados);
    onDone();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{reserva ? 'Editar' : 'Nova'} Reserva</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.text2} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 460 }}>
            <Text style={styles.mLabel}>Sala *</Text>
            <View style={styles.chipsRow}>
              {salas.map(s => (
                <TouchableOpacity key={s.id} style={[styles.chip, salaId === s.id && styles.chipActive]} onPress={() => setSalaId(s.id)}>
                  <Text style={[styles.chipTxt, salaId === s.id && styles.chipTxtActive]}>{s.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.mLabel}>Turma *</Text>
            <View style={styles.chipsRow}>
              {turmas.map(t => (
                <TouchableOpacity key={t.id} style={[styles.chip, turmaId === t.id && styles.chipActive]} onPress={() => selecionarTurma(t.id)}>
                  <Text style={[styles.chipTxt, turmaId === t.id && styles.chipTxtActive]}>{t.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.mLabel}>Turno *</Text>
            <View style={styles.chipsRow}>
              {turnosSala.map(t => (
                <TouchableOpacity key={t} style={[styles.chip, turno === t && styles.chipActive]} onPress={() => setTurno(t)}>
                  <Text style={[styles.chipTxt, turno === t && styles.chipTxtActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.mLabel}>Dias da semana *</Text>
            <View style={styles.chipsRow}>
              {DIAS_SEMANA.map(d => (
                <TouchableOpacity key={d.v} style={[styles.chip, dias.includes(d.v) && styles.chipActive]} onPress={() => toggleDia(d.v)}>
                  <Text style={[styles.chipTxt, dias.includes(d.v) && styles.chipTxtActive]}>{d.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mLabel}>Inicio *</Text>
                <DatePickerField value={ini} onChange={setIni} placeholder="Selecionar inicio" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mLabel}>Fim *</Text>
                <DatePickerField value={fim} onChange={setFim} placeholder="Selecionar fim" minDate={ini || undefined} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mLabel}>Hora inicio (opcional)</Text>
                <TimePickerField value={horaIni} onChange={setHoraIni} placeholder="08:00" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mLabel}>Hora fim (opcional)</Text>
                <TimePickerField value={horaFim} onChange={setHoraFim} placeholder="10:00" />
              </View>
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <Button title="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button title={reserva ? 'Salvar' : 'Criar'} variant="primary" icon="checkmark" onPress={salvar} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---- Solicitacoes ----
function Solicitacoes({ uid, sessaoId, onChange }: { uid: number | null; sessaoId: number; onChange: () => void }) {
  const [busca, setBusca] = useState('');
  const [comentarioSolic, setComentarioSolic] = useState<Solicitacao | null>(null);
  const [txtComentario, setTxtComentario] = useState('');
  const [acaoSolic, setAcaoSolic] = useState<'aprovada' | 'recusada'>('aprovada');

  const list = db.getSolics()
    .filter(s => s.unidadeId === uid)
    .filter(s => {
      const sala  = db.getSalaById(s.salaId);
      const inst  = db.getUserById(s.instrutorId);
      const turma = s.turmaId ? db.getTurmaById(s.turmaId) : null;
      return matchBusca(busca, sala?.nome, inst?.nome, turma?.nome, s.status, s.turnos.join(' '), s.data, s.dataInicio, s.dataFim, s.motivo);
    })
    .sort((a, b) => {
      if (a.status === 'pendente' && b.status !== 'pendente') return -1;
      if (a.status !== 'pendente' && b.status === 'pendente') return 1;
      return (b.criadaEm ?? '').localeCompare(a.criadaEm ?? '');
    });

  const prepararResposta = (s: Solicitacao, status: 'aprovada' | 'recusada') => {
    // Espelha o prompt de comentario do web antes de aprovar/recusar
    setAcaoSolic(status);
    setTxtComentario(status === 'recusada' ? 'Sala bloqueada para manutencao.' : '');
    setComentarioSolic(s);
  };

  const confirmarResposta = async () => {
    const s = comentarioSolic;
    if (!s) return;
    const comentario = txtComentario.trim();
    setComentarioSolic(null);
    await responder(s, acaoSolic, comentario || undefined);
  };

  const responder = async (s: Solicitacao, status: 'aprovada' | 'recusada', comentario?: string) => {
    await db.updSolic(s.id, { status, ...(comentario ? { resposta: comentario } : {}), respondidaEm: new Date().toISOString() });
    const sala = db.getSalaById(s.salaId);
    if (status === 'aprovada') {
      const dataIni = s.dataInicio ?? s.data;
      const dataFim = s.dataFim ?? s.data;
      const dias = s.diasSemana && s.diasSemana.length ? s.diasSemana : [db.diaDaSemana(dataIni)];
      for (const turno of s.turnos) {
        const conflito = db.verificarConflito({ salaId: s.salaId, turno, diasSemana: dias, dataInicio: dataIni, dataFim });
        if (!conflito) {
          await db.addReserva({
            salaId: s.salaId, turmaId: s.turmaId ?? null, turno,
            diasSemana: dias, dataInicio: dataIni, dataFim,
            horaInicio: s.horaInicio ?? null, horaFim: s.horaFim ?? null,
            instrutorId: s.instrutorId, unidadeId: uid!, avulsa: !s.turmaId,
          });
        }
      }
    }
    const comentarioTxt = comentario ? ` Comentario: "${comentario}"` : '';
    await db.addNotif({
      tipo: status === 'aprovada' ? 'aprovada' : 'recusada',
      titulo: status === 'aprovada' ? 'Solicitacao aprovada' : 'Solicitacao recusada',
      msg: `Sua solicitacao da sala "${sala?.nome ?? '?'}" foi ${status}.${comentarioTxt}`,
      paraPerfil: 'instrutor', paraId: s.instrutorId, unidadeId: uid,
    });
    onChange();
  };

  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar solicitacoes" />
      {list.map(s => {
        const sala  = db.getSalaById(s.salaId);
        const inst  = db.getUserById(s.instrutorId);
        const turma = s.turmaId ? db.getTurmaById(s.turmaId) : null;
        const pend  = s.status === 'pendente';
        const cor   = pend ? Colors.amber : s.status === 'aprovada' ? Colors.green : Colors.red;
        const dataStr = (s.dataInicio && s.dataFim && s.dataInicio !== s.dataFim)
          ? `${db.fmtData(s.dataInicio)} a ${db.fmtData(s.dataFim)}`
          : db.fmtData(s.data ?? s.dataInicio);
        return (
          <Card key={s.id} style={[styles.solicCard, { borderLeftColor: cor }]}>
            <View style={styles.rowBetween}>
              <Text style={styles.salaNome}>{inst?.nome ?? 'Instrutor'}</Text>
              <Badge label={s.status.toUpperCase()} tone={pend ? 'amber' : s.status === 'aprovada' ? 'green' : 'red'} />
            </View>
            <Text style={styles.solicData}>{db.fmtDateTime(s.criadaEm)}</Text>

            <View style={styles.solicGrid}>
              <View style={styles.solicCol}>
                <Text style={styles.solicLabel}>Sala</Text>
                <Text style={styles.solicValor}>{sala?.nome ?? '-'}</Text>
                <Text style={styles.solicSub}>{sala?.bloco} · {sala?.andar}</Text>
              </View>
              <View style={styles.solicCol}>
                <Text style={styles.solicLabel}>Data</Text>
                <Text style={styles.solicValor}>{dataStr}</Text>
                {s.diasSemana?.length ? <Text style={styles.solicSub}>{db.fmtDiasSemana(s.diasSemana)}</Text> : null}
              </View>
              <View style={styles.solicCol}>
                <Text style={styles.solicLabel}>Turno(s)</Text>
                <Text style={styles.solicValor}>{s.turnos.join(', ')}</Text>
                {s.horaInicio && s.horaFim ? <Text style={styles.solicSub}>{s.horaInicio} as {s.horaFim}</Text> : null}
              </View>
              <View style={styles.solicCol}>
                <Text style={styles.solicLabel}>Turma</Text>
                <Text style={styles.solicValor}>{turma?.nome ?? '-'}</Text>
              </View>
            </View>

            {s.motivo ? (
              <View style={styles.motivoBox}>
                <Text style={styles.motivoTxt}>{s.motivo}</Text>
              </View>
            ) : null}

            {s.resposta ? (
              <View style={[styles.motivoBox, { borderLeftWidth: 3, borderLeftColor: cor }]}>
                <Text style={[styles.motivoTxt, { color: cor, fontWeight: '700' }]}>
                  Resposta do coordenador
                </Text>
                <Text style={[styles.motivoTxt, { marginTop: 2 }]}>{s.resposta}</Text>
              </View>
            ) : null}

            {pend && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Button title="Aprovar" variant="success" size="sm" icon="checkmark" onPress={() => prepararResposta(s, 'aprovada')} style={{ flex: 1 }} />
                <Button title="Recusar" variant="danger" size="sm" icon="close" onPress={() => prepararResposta(s, 'recusada')} style={{ flex: 1 }} />
              </View>
            )}
          </Card>
        );
      })}
      {!list.length && <EmptyState icon="clipboard-outline" text="Nenhuma solicitacao encontrada." />}

      {comentarioSolic && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setComentarioSolic(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {acaoSolic === 'aprovada' ? 'Aprovar solicitacao' : 'Recusar solicitacao'}
                </Text>
                <TouchableOpacity onPress={() => setComentarioSolic(null)}><Ionicons name="close" size={24} color={Colors.text2} /></TouchableOpacity>
              </View>
              <Text style={styles.mLabel}>Comentario para o instrutor</Text>
              <TextInput
                style={[styles.mInput, { height: 84, textAlignVertical: 'top' }]}
                multiline
                value={txtComentario}
                onChangeText={setTxtComentario}
                placeholder={acaoSolic === 'recusada' ? 'Motivo da recusa...' : 'Comentario (opcional)...'}
                placeholderTextColor={Colors.text3}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <Button title="Cancelar" variant="ghost" onPress={() => setComentarioSolic(null)} style={{ flex: 1 }} />
                <Button title="Confirmar" variant="primary" icon="checkmark" onPress={confirmarResposta} style={{ flex: 1 }} />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ---- Notificacoes ----
function Notificacoes({ uid }: { uid: number | null }) {
  const [list, setList] = useState<Notificacao[]>([]);
  const [busca, setBusca] = useState('');
  useEffect(() => {
    const l = db.getNotifsPara('coordenador', uid);
    setList(l);
    db.marcarTodasLidas('coordenador', uid);
  }, [uid]);

  if (!list.length) return <EmptyState icon="notifications-outline" text="Sem notificacoes." />;
  const filtradas = list.filter(n => matchBusca(busca, n.titulo, n.msg, n.tipo, n.criadaEm));

  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar avisos" />
      {filtradas.map(n => (
        <Card key={n.id} style={{ marginBottom: 10, flexDirection: 'row', gap: 12 }}>
          <Text style={{ fontSize: 20 }}>{'•'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifTitle}>{n.titulo}</Text>
            <Text style={styles.notifMsg}>{n.msg}</Text>
            <Text style={styles.notifTime}>{db.fmtDateTime(n.criadaEm)}</Text>
          </View>
        </Card>
      ))}
      {!filtradas.length && <EmptyState icon="notifications-outline" text="Nenhum aviso encontrado." />}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  blockTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  turmaCodigo: { fontSize: 14, fontWeight: '700', color: Colors.text },
  turmaCurso: { fontSize: 13, color: Colors.text2, marginTop: 4 },
  turmaMeta: { fontSize: 12, color: Colors.text3, marginTop: 3 },
  salaNome: { fontSize: 15, fontWeight: '800', color: Colors.text },
  reservaMetaRow: { marginTop: 6 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 16, padding: 12, backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legDot: { width: 10, height: 10, borderRadius: 5 },
  legTxt: { fontSize: 12, color: Colors.text2, fontWeight: '600' },
  solicCard: { marginBottom: 12, borderLeftWidth: 3 },
  solicData: { fontSize: 11, color: Colors.text3, marginTop: 2 },
  solicGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  solicCol: { width: '50%', marginBottom: 8 },
  solicLabel: { fontSize: 11, color: Colors.text3 },
  solicValor: { fontSize: 13, fontWeight: '700', color: Colors.text, marginTop: 1 },
  solicSub: { fontSize: 11, color: Colors.text3, marginTop: 1 },
  motivoBox: { backgroundColor: Colors.surface2, borderRadius: 8, padding: 10, marginTop: 4 },
  motivoTxt: { fontSize: 12, color: Colors.text2 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  notifMsg: { fontSize: 13, color: Colors.text2, marginTop: 2 },
  notifTime: { fontSize: 11, color: Colors.text3, marginTop: 4 },
  filtroRow: { marginBottom: 10 },
  filtroLabel: { fontSize: 12, color: Colors.text3, fontWeight: '700', marginBottom: 6 },
  filtroChips: { gap: 8, paddingRight: 8 },
  filtroChip: {
    minHeight: 32, paddingHorizontal: 14, borderRadius: 7,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.surface,
    justifyContent: 'center',
  },
  filtroChipAtivo: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filtroChipTxt: { fontSize: 12, fontWeight: '700', color: Colors.text2 },
  filtroChipTxtAtivo: { color: '#fff' },
  legTotal: { fontSize: 12, color: Colors.text2, fontWeight: '800' },
  // Override manual no mapa
  overrideBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: -6, marginBottom: 12, paddingHorizontal: 4,
  },
  overrideBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.surface2,
  },
  overrideAtivo: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  overrideDot: { width: 8, height: 8, borderRadius: 4 },
  overrideTxt: { fontSize: 11, fontWeight: '700', color: Colors.text2 },
  overrideAuto: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.surface,
    marginLeft: 'auto',
  },
  overrideAutoTxt: { fontSize: 11, fontWeight: '700', color: Colors.text2 },
  // Mini status (instrutores)
  miniStatus: {
    backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border2,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  miniStatusTxt: { fontSize: 10, fontWeight: '700', color: Colors.text2 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, flex: 1 },
  mLabel: { fontSize: 12, fontWeight: '700', color: Colors.text2, marginBottom: 5, marginTop: 12 },
  mInput: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { fontSize: 12, fontWeight: '600', color: Colors.text2 },
  chipTxtActive: { color: '#fff' },
  // Atribuir turmas
  turmaCheck: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
    padding: 12, marginBottom: 8, backgroundColor: Colors.surface,
  },
  turmaCheckAtivo: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  turmaCheckNome: { fontSize: 14, fontWeight: '700', color: Colors.text },
});
