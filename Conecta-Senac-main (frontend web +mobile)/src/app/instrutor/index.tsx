import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TextInput,
  TouchableOpacity, Modal, ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useRequirePerfil, useAuth } from '@/hooks/useAuth';
import { ScreenShell } from '@/components/ScreenShell';
import { Card, Badge, StatusPill, Button, EmptyState, SearchBar } from '@/components/ui';
import Calendario from '@/components/Calendario';
import DatePickerField from '@/components/DatePickerField';
import TimePickerField from '@/components/TimePickerField';
import * as db from '@/services/storage';
import { Sala, Turno, DiaSemana, ModoData, Notificacao, Sessao } from '@/types';




const TABS = [
  { key: 'turmas',  label: 'Turmas',   icon: 'school-outline' as const },
  { key: 'calendario', label: 'Calendario', icon: 'calendar-outline' as const },
  { key: 'salas',   label: 'Solicitar',icon: 'add-circle-outline' as const },
  { key: 'solicitacoes', label: 'Pedidos', icon: 'clipboard-outline' as const },
  { key: 'chaves',  label: 'Chaves',   icon: 'key-outline' as const },
  { key: 'notifs',  label: 'Avisos',   icon: 'notifications-outline' as const },
];

const matchBusca = (busca: string, ...valores: Array<string | number | null | undefined>) => {
  const q = busca.trim().toLowerCase();
  if (!q) return true;
  return valores.some(v => String(v ?? '').toLowerCase().includes(q));
};

export default function InstrutorPanel() {
  const { sessao, pronto } = useRequirePerfil('instrutor');
  const { sair } = useAuth();
  const [tab, setTab] = useState('turmas');
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  const recarregar = useCallback(async () => {
    setRefreshing(true); await db.initDados(true); setTick(t => t + 1); setRefreshing(false);
  }, []);

  if (!pronto) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const uid = sessao!.unidadeId;
  const naoLidas = db.countNaoLidas('instrutor', uid, sessao!.id);
  const tabs = TABS.map(t => ({ ...t, badge: t.key === 'notifs' ? naoLidas : undefined }));

  const meta: Record<string, { t: string; s: string }> = {
    turmas: { t: 'Minhas Turmas', s: 'Turmas atribuidas a voce' },
    calendario: { t: 'Calendario', s: 'Calendario das suas reservas' },
    salas:  { t: 'Solicitar Sala', s: 'Solicite uma sala disponivel' },
    solicitacoes: { t: 'Minhas Solicitações', s: 'Acompanhe seus pedidos de sala' },
    chaves: { t: 'Chaves', s: 'Chaves sob sua responsabilidade' },
    notifs: { t: 'Notificacoes', s: 'Avisos e respostas' },
  };

  return (
    <ScreenShell
      sessao={sessao} perfilLabel="Instrutor"
      title={meta[tab].t} subtitle={meta[tab].s}
      tabs={tabs} activeTab={tab} onTabChange={setTab}
      onLogout={sair} onRefresh={recarregar} refreshing={refreshing}
    >
      {tab === 'turmas' && <MinhasTurmas sessaoId={sessao!.id} key={`t${tick}`} />}
      {tab === 'calendario' && <CalendarioArea sessao={sessao!} key={`ca${tick}`} />}
      {tab === 'salas'  && <SolicitarSala sessaoId={sessao!.id} uid={uid} onDone={recarregar} key={`s${tick}`} />}
      {tab === 'solicitacoes' && <MinhasSolicitacoes sessaoId={sessao!.id} key={`so${tick}`} />}
      {tab === 'chaves' && <MinhasChaves sessaoId={sessao!.id} uid={uid} key={`c${tick}`} />}
      {tab === 'notifs' && <Notifs uid={uid} sessaoId={sessao!.id} key={`n${tick}`} />}
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

// ---- Minhas Turmas ----
function MinhasTurmas({ sessaoId }: { sessaoId: number }) {
  const [busca, setBusca] = useState('');
  const list = db.getTurmas().filter(t => t.instrutorId === sessaoId && matchBusca(busca, t.nome, t.codigo, t.curso, t.turno, t.dataInicio, t.dataFim, db.calcStatus(t)));
  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar turmas" />
      {list.map(t => (
        <Card key={t.id} style={{ marginBottom: 10 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.turmaCodigo}>{t.nome}</Text>
            <StatusPill status={db.calcStatus(t)} />
          </View>
          <Text style={styles.turmaCurso}>{t.curso}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center' }}>
            <Badge label={t.turno} tone="primary" />
            <Text style={styles.turmaMeta}>{db.fmtData(t.dataInicio)} a {db.fmtData(t.dataFim)}</Text>
          </View>
        </Card>
      ))}
      {!list.length && <EmptyState icon="school-outline" text="Nenhuma turma encontrada." />}
    </View>
  );
}

// ---- Solicitar Sala ----
function SolicitarSala({ sessaoId, uid, onDone }: { sessaoId: number; uid: number; onDone: () => void }) {
  const [busca, setBusca] = useState('');
  const salas = db.getSalasByUnidade(uid).filter(s => matchBusca(busca, s.nome, s.tipo, s.andar, s.bloco, s.capacidade, s.turnosDisponiveis.join(' ')));
  const [modalSala, setModalSala] = useState<Sala | null>(null);

  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar salas" />
      {salas.map(s => (
        <Card key={s.id} style={{ marginBottom: 10 }}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.salaNome}>{s.nome}</Text>
              <Text style={styles.turmaCurso}>{s.tipo}</Text>
            </View>
          </View>
          <Text style={styles.turmaMeta}>{s.bloco} · {s.andar} · {s.capacidade} lugares</Text>
          <View style={{ flexDirection: 'row', gap: 5, marginTop: 8 }}>
            {s.turnosDisponiveis.map(t => (
              <View key={t} style={styles.turnoChip}><Text style={styles.turnoChipTxt}>{t[0]}</Text></View>
            ))}
          </View>
          <Button title="Solicitar" variant="primary" size="sm" icon="paper-plane-outline"
            onPress={() => setModalSala(s)} style={{ marginTop: 10 }} />
        </Card>
      ))}
      {!salas.length && <EmptyState icon="business-outline" text="Nenhuma sala encontrada." />}

      {modalSala && (
        <ModalSolicitar
          sala={modalSala} sessaoId={sessaoId} uid={uid}
          onClose={() => setModalSala(null)}
          onDone={() => { setModalSala(null); onDone(); }}
        />
      )}
    </View>
  );
}

function ModalSolicitar({ sala, sessaoId, uid, onClose, onDone }: { sala: Sala; sessaoId: number; uid: number; onClose: () => void; onDone: () => void }) {
  const [modo, setModo] = useState<ModoData>('unica');
  const [data, setData] = useState('');
  const [dataIni, setDataIni] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [horaIni, setHoraIni] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [turmaId, setTurmaId] = useState<number | null>(null);
  const [buscaTurma, setBuscaTurma] = useState('');
  const [motivo, setMotivo] = useState('');

  const minhasTurmas = db.getTurmas().filter(t =>
    t.instrutorId === sessaoId &&
    db.calcStatus(t) !== 'encerrada' &&
    matchBusca(buscaTurma, t.nome, t.codigo, t.curso, t.turno)
  );

  const toggleTurno = (t: Turno) => setTurnos(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  const enviar = async () => {
    if (!turnos.length) { Alert.alert('Atencao', 'Selecione ao menos um turno.'); return; }
    if (!turmaId) { Alert.alert('Atencao', 'Selecione a turma.'); return; }
    if (!horaIni.trim() || !horaFim.trim()) { Alert.alert('Atencao', 'Informe o horario de inicio e fim.'); return; }
    if (!motivo.trim()) { Alert.alert('Atencao', 'Descreva o motivo.'); return; }
    let di = '', df = '';
    if (modo === 'unica') {
      if (!data) { Alert.alert('Atencao', 'Informe a data.'); return; }
      di = df = data;
    } else {
      if (!dataIni || !dataFim) { Alert.alert('Atencao', 'Informe inicio e fim.'); return; }
      di = dataIni; df = dataFim;
    }
    // Calcula os dias da semana do periodo (mesmo formato do web: ['seg','ter',...])
    const datasNoPeriodo: string[] = [];
    if (modo === 'periodo' && di && df && df >= di) {
      const ini = new Date(di + 'T00:00:00');
      const fim = new Date(df + 'T00:00:00');
      for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
        datasNoPeriodo.push(d.toISOString().split('T')[0]);
      }
    }
    const datasNucleo = modo === 'unica' ? [di] : datasNoPeriodo;
    const diasSemana: DiaSemana[] = Array.from(new Set(
      (datasNucleo.length ? datasNucleo : [di]).map(d => db.diaDaSemana(d))
    ));
    await db.addSolic({
      salaId: sala.id, instrutorId: sessaoId, turmaId, turnos,
      turno: turnos[0], // compatibilidade com o web (solicitacoes antigas usam turno)
      data: di, dataInicio: di, dataFim: df,
      diasSemana: diasSemana.length ? diasSemana : null,
      horaInicio: horaIni.trim() || null, horaFim: horaFim.trim() || null, motivo: motivo.trim(),
      status: 'pendente', unidadeId: uid, modo, criadaEm: new Date().toISOString(),
    });
    await db.addNotif({
      tipo: 'solicit', titulo: 'Nova Solicitacao de Sala',
      msg: `Solicitacao da sala "${sala.nome}" em ${db.fmtData(di)}.`,
      paraPerfil: 'coordenador', paraId: null, unidadeId: uid,
    });
    Alert.alert('Sucesso', 'Solicitacao enviada! Aguarde aprovacao.');
    onDone();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Solicitar {sala.nome}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.text2} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 480 }}>
            {/* Modo de data */}
            <Text style={styles.mLabel}>Tipo de data *</Text>
            <View style={styles.segmentRow}>
              {(['unica', 'periodo'] as ModoData[]).map(m => (
                <TouchableOpacity key={m} style={[styles.segment, modo === m && styles.segmentActive]} onPress={() => setModo(m)}>
                  <Text style={[styles.segmentTxt, modo === m && styles.segmentTxtActive]}>
                    {m === 'unica' ? 'Data unica' : 'Periodo'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {modo === 'unica' && (
              <><Text style={styles.mLabel}>Data *</Text>
              <DatePickerField value={data} onChange={setData} placeholder="Selecionar data" /></>
            )}
            {modo === 'periodo' && (
              <>
                <Text style={styles.mLabel}>Data inicio *</Text>
                <DatePickerField value={dataIni} onChange={setDataIni} placeholder="Selecionar data de inicio" />
                <Text style={styles.mLabel}>Data fim *</Text>
                <DatePickerField value={dataFim} onChange={setDataFim} placeholder="Selecionar data de fim" minDate={dataIni || undefined} />
              </>
            )}

            {/* Turnos */}
            <Text style={styles.mLabel}>Turno(s) *</Text>
            <View style={styles.chipsRow}>
              {sala.turnosDisponiveis.map(t => (
                <TouchableOpacity key={t} style={[styles.chip, turnos.includes(t) && styles.chipActive]} onPress={() => toggleTurno(t)}>
                  <Text style={[styles.chipTxt, turnos.includes(t) && styles.chipTxtActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Horario */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mLabel}>Hora inicio *</Text>
                <TimePickerField value={horaIni} onChange={setHoraIni} placeholder="08:00" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mLabel}>Hora fim *</Text>
                <TimePickerField value={horaFim} onChange={setHoraFim} placeholder="10:00" />
              </View>
            </View>

            {/* Turma */}



            <Text style={styles.mLabel}>Turma *</Text>
            <SearchBar value={buscaTurma} onChangeText={setBuscaTurma} placeholder="Pesquisar turmas" />
            <View style={styles.chipsRow}>
              {minhasTurmas.map(t => (
                <TouchableOpacity key={t.id} style={[styles.chip, turmaId === t.id && styles.chipActive]} onPress={() => setTurmaId(t.id)}>
                  <Text style={[styles.chipTxt, turmaId === t.id && styles.chipTxtActive]}>{t.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!minhasTurmas.length && buscaTurma ? <EmptyState icon="school-outline" text="Nenhuma turma encontrada." /> : null}

            {/* Motivo */}
            <Text style={styles.mLabel}>Motivo *</Text>
            <TextInput style={[styles.mInput, { height: 70, textAlignVertical: 'top' }]} multiline
              placeholder="Descreva o motivo..." value={motivo} onChangeText={setMotivo} placeholderTextColor={Colors.text3} />
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <Button title="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Enviar" variant="primary" icon="paper-plane-outline" onPress={enviar} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---- Minhas Solicitacoes (acompanha pedidos + comentario do coordenador) ----
function MinhasSolicitacoes({ sessaoId }: { sessaoId: number }) {
  const [busca, setBusca] = useState('');
  const list = db.getSolics()
    .filter(s => s.instrutorId === sessaoId)
    .filter(s => {
      const sala = db.getSalaById(s.salaId);
      const turma = s.turmaId ? db.getTurmaById(s.turmaId) : null;
      const turnosStr = Array.isArray(s.turnos) ? s.turnos.join(', ') : (s.turno ?? '');
      return matchBusca(busca, sala?.nome, turma?.nome, s.status, turnosStr, s.data, s.dataInicio, s.dataFim, s.motivo, s.resposta);
    })
    .sort((a, b) => (b.criadaEm ?? '').localeCompare(a.criadaEm ?? ''));

  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar pedidos" />
      {list.map(s => {
        const sala = db.getSalaById(s.salaId);
        const turma = s.turmaId ? db.getTurmaById(s.turmaId) : null;
        const turnosStr = Array.isArray(s.turnos) && s.turnos.length
          ? s.turnos.join(', ')
          : (s.turno ?? '—');
        const pend = s.status === 'pendente';
        const cor = pend ? Colors.amber : s.status === 'aprovada' ? Colors.green : Colors.red;
        const dataLabel = (s.dataInicio && s.dataFim && s.dataInicio !== s.dataFim)
          ? `${db.fmtData(s.dataInicio)} a ${db.fmtData(s.dataFim)}`
          : db.fmtData(s.data ?? s.dataInicio);
        return (
          <Card key={s.id} style={[styles.solicitCard, { borderLeftColor: cor, borderLeftWidth: 3 }]}>
            <View style={styles.rowBetween}>
              <Text style={styles.salaNome}>{sala?.nome ?? 'Sala'}</Text>
              <StatusPillPedido status={s.status} />
            </View>
            <Text style={styles.turmaMeta}>Solicitada em: {db.fmtDateTime(s.criadaEm)}</Text>
            <Text style={styles.turmaMeta}>Data: {dataLabel}</Text>
            <Text style={styles.turmaMeta}>Turno(s): {turnosStr}</Text>
            {s.horaInicio && s.horaFim ? (
              <Text style={styles.turmaMeta}>Horario: {s.horaInicio} as {s.horaFim}</Text>
            ) : null}
            {turma ? <Text style={styles.turmaMeta}>Turma: {turma.nome}</Text> : null}
            {s.motivo ? (
              <View style={styles.motivoBox}>
                <Text style={styles.motivoLabel}>Motivo</Text>
                <Text style={styles.motivoTxt}>{s.motivo}</Text>
              </View>
            ) : null}
            {s.resposta ? (
              <View style={[styles.motivoBox, { borderLeftWidth: 3, borderLeftColor: cor, marginTop: 8 }]}>
                <Text style={[styles.motivoLabel, { color: cor }]}>
                  Resposta do coordenador
                </Text>
                <Text style={[styles.motivoTxt, { marginTop: 2 }]}>{s.resposta}</Text>
                {s.respondidaEm ? (
                  <Text style={styles.turmaMeta}>Em: {db.fmtDateTime(s.respondidaEm)}</Text>
                ) : null}
              </View>
            ) : null}
          </Card>
        );
      })}
      {!list.length && <EmptyState icon="clipboard-outline" text="Nenhuma solicitacao encontrada." />}
    </View>
  );
}

// Badge de status para pedidos do instrutor (pendente/aprovada/recusada)
function StatusPillPedido({ status }: { status: string }) {
  const tone = status === 'pendente' ? 'amber' : status === 'aprovada' ? 'green' : 'red' as const;
  return <Badge label={status.toUpperCase()} tone={tone} />;
}

// ---- Minhas Chaves ----
function MinhasChaves({ sessaoId, uid }: { sessaoId: number; uid: number }) {
  const [busca, setBusca] = useState('');
  const list = db.getChaves().filter(c => {
    const sala = db.getSalaById(c.salaId);
    return c.unidadeId === uid && c.instrutorId === sessaoId && matchBusca(busca, c.codigo, c.andar, c.pegaEm, sala?.nome);
  });
  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar chaves" />
      {list.map(c => {
        const sala = db.getSalaById(c.salaId);
        return (
          <Card key={c.id} style={{ marginBottom: 10, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={styles.keyIcon}><Ionicons name="key" size={20} color={Colors.amber} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.salaNome}>{sala?.nome ?? '-'} — {c.codigo}</Text>
              <Text style={styles.turmaMeta}>Andar: {c.andar}</Text>
              <Text style={styles.turmaMeta}>Retirada em: {db.fmtDateTime(c.pegaEm)}</Text>
            </View>
          </Card>
        );
      })}
      {!list.length && <EmptyState icon="key-outline" text="Nenhuma chave encontrada." />}
    </View>
  );
}

// ---- Notifs ----
function Notifs({ uid, sessaoId }: { uid: number; sessaoId: number }) {
  const [list, setList] = useState<Notificacao[]>([]);
  const [busca, setBusca] = useState('');
  useEffect(() => {
    setList(db.getNotifsPara('instrutor', uid, sessaoId).filter(n => !n.paraId || n.paraId === sessaoId));
    db.marcarTodasLidas('instrutor', uid, sessaoId);
  }, [uid, sessaoId]);
  if (!list.length) return <EmptyState icon="notifications-outline" text="Sem notificacoes." />;
  const filtradas = list.filter(n => matchBusca(busca, n.titulo, n.msg, n.tipo, n.criadaEm));
  return (
    <View>
      <SearchBar value={busca} onChangeText={setBusca} placeholder="Pesquisar avisos" />
      {filtradas.map(n => (
        <Card key={n.id} style={{ marginBottom: 10 }}>
          <Text style={styles.notifTitle}>{n.titulo}</Text>
          <Text style={styles.notifMsg}>{n.msg}</Text>
          <Text style={styles.notifTime}>{db.fmtDateTime(n.criadaEm)}</Text>
        </Card>
      ))}
      {!filtradas.length && <EmptyState icon="notifications-outline" text="Nenhum aviso encontrado." />}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  turmaCodigo: { fontSize: 14, fontWeight: '700', color: Colors.text },
  turmaCurso: { fontSize: 13, color: Colors.text2, marginTop: 2 },
  turmaMeta: { fontSize: 12, color: Colors.text3, marginTop: 3 },
  salaNome: { fontSize: 15, fontWeight: '800', color: Colors.text },
  turnoChip: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center' },
  turnoChipTxt: { fontSize: 12, fontWeight: '700', color: Colors.text3 },
  keyIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.amberLight, alignItems: 'center', justifyContent: 'center' },
  notifTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  notifMsg: { fontSize: 13, color: Colors.text2, marginTop: 2 },
  notifTime: { fontSize: 11, color: Colors.text3, marginTop: 4 },
  solicitCard: { marginBottom: 12 },
  motivoBox: { backgroundColor: Colors.surface2, borderRadius: 8, padding: 10, marginTop: 4 },
  motivoLabel: { fontSize: 11, color: Colors.text3, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  motivoTxt: { fontSize: 12, color: Colors.text2 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  mLabel: { fontSize: 12, fontWeight: '700', color: Colors.text2, marginBottom: 5, marginTop: 12 },
  mInput: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text },
  segmentRow: { flexDirection: 'row', backgroundColor: Colors.bg3, borderRadius: 8, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  segmentActive: { backgroundColor: Colors.surface },
  segmentTxt: { fontSize: 12, fontWeight: '600', color: Colors.text3 },
  segmentTxtActive: { color: Colors.primary, fontWeight: '700' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { fontSize: 12, fontWeight: '600', color: Colors.text2 },
  chipTxtActive: { color: '#fff' },
});
