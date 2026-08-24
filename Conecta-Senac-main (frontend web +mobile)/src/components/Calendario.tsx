/*
 * Calendario.tsx — Calendário de reservas do mobile.
 *
 * Espelha o calendario.html do web:
 *   - Visualização por MÊS ou por SEMANA;
 *   - Cada dia mostra "pílulas" coloridas por turno (Matutino, Vespertino,
 *     Noturno) conforme as reservas; selecionar um dia abre o painel de
 *     detalhes logo abaixo;
 *   - Filtros por sala e por turno;
 *   - O conteúdo vem das props (db.getReservas(), db.getSalas() etc.), ou
 *     seja, dos dados sincronizados com o servidor central — o mesmo banco
 *     usado pelo web.
 */

import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { criarEstilos } from '@/theme/theme';
import { EstadoCalendario, Reserva, Sala, Sessao, Turma, Usuario } from '@/types';

const MESES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'];
const TURNOS = ['Matutino', 'Vespertino', 'Noturno'] as const;

type TurnoVisual = 'mat' | 'ves' | 'not' | 'avul';

interface CalendarioProps {
  reservas: Reserva[];
  salas: Sala[];
  turmas: Turma[];
  usuarios: Usuario[];
  sessao: Sessao;
}

type DiaCalendario = {
  data: Date;
  dia: number;
  outroMes: boolean;
};

export default function Calendario({ reservas, salas, turmas, usuarios, sessao }: CalendarioProps) {
  const hoje = zerarHora(new Date());

  const [estado, setEstado] = useState<EstadoCalendario>({
    ano: hoje.getFullYear(),
    mes: hoje.getMonth(),
    vista: 'mes',
    diaSel: hoje,
    semBase: getSegundaFeira(hoje),
    filtSala: '',
    filtTurno: '',
  });

  const salaMap = useMemo(() => new Map(salas.map(s => [s.id, s])), [salas]);
  const turmaMap = useMemo(() => new Map(turmas.map(t => [t.id, t])), [turmas]);
  const usuarioMap = useMemo(() => new Map(usuarios.map(u => [u.id, u])), [usuarios]);

  const salasVisiveis = useMemo(() => (
    sessao.perfil === 'admin'
      ? salas
      : salas.filter(s => String(s.unidadeId) === String(sessao.unidadeId))
  ), [salas, sessao]);

  const reservasFiltradas = useMemo(() => {
    let lista = reservas;

    if (sessao.perfil === 'instrutor') {
      lista = lista.filter(r => {
        const turma = r.turmaId ? turmaMap.get(r.turmaId) : null;
        return String(r.instrutorId) === String(sessao.id) || String(turma?.instrutorId ?? '') === String(sessao.id);
      });
    } else if (sessao.perfil !== 'admin') {
      lista = lista.filter(r => String(r.unidadeId) === String(sessao.unidadeId));
    }

    if (estado.filtSala) lista = lista.filter(r => String(r.salaId) === estado.filtSala);
    if (estado.filtTurno) lista = lista.filter(r => r.turno === estado.filtTurno);

    return lista;
  }, [reservas, sessao, turmaMap, estado.filtSala, estado.filtTurno]);

  const diasDoMes = useMemo(() => montarDiasDoMes(estado.ano, estado.mes), [estado.ano, estado.mes]);
  const diasDaSemana = useMemo(() => montarDiasDaSemana(estado.semBase), [estado.semBase]);
  const selecionadoISO = formatarISO(estado.diaSel);
  const listaDia = reservasFiltradas.filter(r => ocorreReserva(r, estado.diaSel));

  const navegarAnterior = () => {
    setEstado(prev => {
      if (prev.vista === 'semana') {
        const semBase = adicionarDias(prev.semBase, -7);
        return { ...prev, semBase, diaSel: semBase, ano: semBase.getFullYear(), mes: semBase.getMonth() };
      }

      const mes = prev.mes === 0 ? 11 : prev.mes - 1;
      const ano = prev.mes === 0 ? prev.ano - 1 : prev.ano;
      return { ...prev, mes, ano };
    });
  };

  const navegarProximo = () => {
    setEstado(prev => {
      if (prev.vista === 'semana') {
        const semBase = adicionarDias(prev.semBase, 7);
        return { ...prev, semBase, diaSel: semBase, ano: semBase.getFullYear(), mes: semBase.getMonth() };
      }

      const mes = prev.mes === 11 ? 0 : prev.mes + 1;
      const ano = prev.mes === 11 ? prev.ano + 1 : prev.ano;
      return { ...prev, mes, ano };
    });
  };

  const irParaHoje = () => {
    setEstado(prev => ({
      ...prev,
      ano: hoje.getFullYear(),
      mes: hoje.getMonth(),
      diaSel: hoje,
      semBase: getSegundaFeira(hoje),
    }));
  };

  const selecionarDia = (data: Date) => {
    setEstado(prev => ({
      ...prev,
      diaSel: data,
      ano: data.getFullYear(),
      mes: data.getMonth(),
      semBase: getSegundaFeira(data),
    }));
  };

  const periodo = estado.vista === 'mes'
    ? `${MESES[estado.mes]} ${estado.ano}`
    : `Semana de ${formatarBR(estado.semBase)}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Linha de navegacao: setas + periodo + Hoje */}
      <View style={styles.navRow}>
        <TouchableOpacity onPress={navegarAnterior} style={styles.iconBtn} hitSlop={8} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.periodoWrap}>
          <Text style={styles.periodo}>{periodo}</Text>
        </View>
        <TouchableOpacity onPress={navegarProximo} style={styles.iconBtn} hitSlop={8} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={irParaHoje} style={styles.todayBtn} activeOpacity={0.7}>
          <Text style={styles.todayBtnText}>Hoje</Text>
        </TouchableOpacity>
      </View>

      {/* Alternancia Mes / Semana */}
      <View style={styles.segment}>
        <TouchableOpacity
          onPress={() => setEstado(prev => ({ ...prev, vista: 'mes' }))}
          style={[styles.segmentBtn, estado.vista === 'mes' && styles.segmentBtnActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, estado.vista === 'mes' && styles.segmentTextActive]}>Mes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setEstado(prev => ({ ...prev, vista: 'semana' }))}
          style={[styles.segmentBtn, estado.vista === 'semana' && styles.segmentBtnActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, estado.vista === 'semana' && styles.segmentTextActive]}>Semana</Text>
        </TouchableOpacity>
      </View>

      {/* Filtros por sala */}
      <View style={styles.filtroBloco}>
        <Text style={styles.filtroLabel}>SALA</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <TouchableOpacity
            onPress={() => setEstado(prev => ({ ...prev, filtSala: '' }))}
            style={[styles.selectChip, !estado.filtSala && styles.selectChipActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.selectChipText, !estado.filtSala && styles.selectChipTextActive]}>Todas</Text>
          </TouchableOpacity>
          {salasVisiveis.map(sala => (
            <TouchableOpacity
              key={sala.id}
              onPress={() => setEstado(prev => ({ ...prev, filtSala: String(sala.id) }))}
              style={[styles.selectChip, estado.filtSala === String(sala.id) && styles.selectChipActive]}
              activeOpacity={0.7}
            >
              <Text numberOfLines={1} style={[styles.selectChipText, estado.filtSala === String(sala.id) && styles.selectChipTextActive]}>
                {sala.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Filtros por turno */}
      <View style={styles.filtroBloco}>
        <Text style={styles.filtroLabel}>TURNO</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <TouchableOpacity
            onPress={() => setEstado(prev => ({ ...prev, filtTurno: '' }))}
            style={[styles.selectChip, !estado.filtTurno && styles.selectChipActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.selectChipText, !estado.filtTurno && styles.selectChipTextActive]}>Todos</Text>
          </TouchableOpacity>
          {TURNOS.map(turno => (
            <TouchableOpacity
              key={turno}
              onPress={() => setEstado(prev => ({ ...prev, filtTurno: turno }))}
              style={[styles.selectChip, estado.filtTurno === turno && styles.selectChipActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.selectChipText, estado.filtTurno === turno && styles.selectChipTextActive]}>{turno}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Legenda */}
      <View style={styles.legend}>
        <LegendaItem tipo="mat" label="Matutino" />
        <LegendaItem tipo="ves" label="Vespertino" />
        <LegendaItem tipo="not" label="Noturno" />
        <LegendaItem tipo="avul" label="Sem turma" />
      </View>

      {/* Grade do calendario */}
      <View style={styles.calendarCard}>
        <View style={styles.weekHeader}>
          {DIAS.map((dia, index) => (
            <Text key={dia} style={[styles.weekHeaderText, index === 6 && styles.weekendText]}>{dia}</Text>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {(estado.vista === 'mes' ? diasDoMes : diasDaSemana).map(item => (
            <DiaCell
              key={formatarISO(item.data)}
              item={item}
              hojeISO={formatarISO(hoje)}
              selecionadoISO={selecionadoISO}
              eventos={reservasFiltradas.filter(r => ocorreReserva(r, item.data))}
              salaMap={salaMap}
              turmaMap={turmaMap}
              onPress={() => selecionarDia(item.data)}
              modo={estado.vista}
            />
          ))}
        </View>
      </View>

      {/* Painel de detalhes do dia selecionado */}
      <View style={styles.sidePanel}>
        <View style={styles.sideHeader}>
          <Text style={styles.sideDate}>
            {selecionadoISO === formatarISO(hoje) ? 'HOJE' : formatarBR(estado.diaSel).toUpperCase()}
          </Text>
          <Text style={styles.sideTitle}>{nomeDiaCompleto(estado.diaSel)}, {estado.diaSel.getDate()} de {MESES[estado.diaSel.getMonth()]}</Text>
        </View>

        <View style={styles.sideBody}>
          {listaDia.length ? (
            TURNOS.map(turno => {
              const eventosTurno = listaDia.filter(r => r.turno === turno);
              if (!eventosTurno.length) return null;

              return (
                <View key={turno} style={styles.turnoGroup}>
                  <View style={styles.turnoTitleRow}>
                    <View style={[styles.legendDot, getDotStyle(obterTipoTurno(turno))]} />
                    <Text style={styles.turnoTitle}>{turno.toUpperCase()}</Text>
                    <Text style={styles.turnoCount}>{eventosTurno.length}</Text>
                  </View>
                  {eventosTurno.map(reserva => (
                    <DetalheReserva
                      key={reserva.id}
                      reserva={reserva}
                      sala={salaMap.get(reserva.salaId)}
                      turma={reserva.turmaId ? turmaMap.get(reserva.turmaId) : undefined}
                      instrutor={reserva.instrutorId ? usuarioMap.get(reserva.instrutorId) : undefined}
                    />
                  ))}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-clear-outline" size={26} color={Colors.text3} />
              <Text style={styles.emptyText}>Nenhuma reserva para este dia.</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function DiaCell({
  item,
  hojeISO,
  selecionadoISO,
  eventos,
  salaMap,
  turmaMap,
  onPress,
  modo,
}: {
  item: DiaCalendario;
  hojeISO: string;
  selecionadoISO: string;
  eventos: Reserva[];
  salaMap: Map<number, Sala>;
  turmaMap: Map<number, Turma>;
  onPress: () => void;
  modo: 'mes' | 'semana';
}) {
  const iso = formatarISO(item.data);
  const isHoje = iso === hojeISO;
  const isSelecionado = iso === selecionadoISO;
  const maxEventos = modo === 'semana' ? 10 : 3;
  const eventosVisiveis = eventos.slice(0, maxEventos);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={[
        styles.dayCell,
        modo === 'semana' && styles.weekCell,
        item.outroMes && styles.outMonthCell,
        isHoje && styles.todayCell,
        isSelecionado && styles.selectedCell,
      ]}
    >
      <View style={styles.dayTop}>
        <Text style={[styles.dayNumber, item.outroMes && styles.outMonthText, isHoje && styles.todayNumber]}>
          {item.dia}
        </Text>
        {isHoje && !isSelecionado && <View style={styles.todayDot} />}
      </View>
      <View style={styles.eventStack}>
        {eventosVisiveis.map(evento => {
          const tipo = obterTipoTurno(evento.turno, evento.avulsa || !evento.turmaId);
          const sala = salaMap.get(evento.salaId);
          const turma = evento.turmaId ? turmaMap.get(evento.turmaId) : null;
          const label = sala?.nome || turma?.nome || 'Reserva';

          return (
            <View key={evento.id} style={[styles.eventPill, getEventStyle(tipo)]}>
              <Text numberOfLines={1} style={[styles.eventText, getEventTextStyle(tipo)]}>{label}</Text>
            </View>
          );
        })}
        {(eventos.length > maxEventos) && (
          <View style={styles.morePill}>
            <Text style={styles.moreText}>+{eventos.length - maxEventos}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function DetalheReserva({ reserva, sala, turma, instrutor }: { reserva: Reserva; sala?: Sala; turma?: Turma; instrutor?: Usuario }) {
  const tipo = obterTipoTurno(reserva.turno, reserva.avulsa || !reserva.turmaId);

  return (
    <View style={[styles.detailCard, getDetailStyle(tipo)]}>
      <View style={styles.detailHeader}>
        <Text style={styles.detailRoom}>{sala?.nome || 'Sala nao encontrada'}</Text>
        <View style={[styles.legendDot, getDotStyle(tipo)]} />
      </View>
      <Text style={styles.detailLine}>{turma?.codigo || 'Sem turma'}{turma?.curso ? ` · ${turma.curso}` : ''}</Text>
      {instrutor && (
        <View style={styles.detailMetaRow}>
          <Ionicons name="person-outline" size={12} color={Colors.text3} />
          <Text style={styles.detailMuted}>{instrutor.nome}</Text>
        </View>
      )}
      {reserva.horaInicio && reserva.horaFim ? (
        <View style={styles.detailMetaRow}>
          <Ionicons name="time-outline" size={12} color={Colors.text3} />
          <Text style={styles.detailMuted}>{reserva.horaInicio} as {reserva.horaFim}</Text>
        </View>
      ) : null}
    </View>
  );
}

function LegendaItem({ tipo, label }: { tipo: TurnoVisual; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, getDotStyle(tipo)]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function montarDiasDoMes(ano: number, mes: number): DiaCalendario[] {
  const primeiro = new Date(ano, mes, 1);
  const offset = (primeiro.getDay() + 6) % 7;
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const prevTotal = new Date(ano, mes, 0).getDate();
  const dias: DiaCalendario[] = [];

  for (let i = offset; i > 0; i -= 1) {
    const dia = prevTotal - i + 1;
    dias.push({ data: new Date(ano, mes - 1, dia), dia, outroMes: true });
  }

  for (let dia = 1; dia <= totalDias; dia += 1) {
    dias.push({ data: new Date(ano, mes, dia), dia, outroMes: false });
  }

  while (dias.length % 7 !== 0) {
    const dia = dias.length - offset - totalDias + 1;
    dias.push({ data: new Date(ano, mes + 1, dia), dia, outroMes: true });
  }

  while (dias.length < 42) {
    const ultimo = dias[dias.length - 1].data;
    const prox = adicionarDias(ultimo, 1);
    dias.push({ data: prox, dia: prox.getDate(), outroMes: true });
  }

  return dias;
}

function montarDiasDaSemana(base: Date): DiaCalendario[] {
  return Array.from({ length: 7 }, (_, index) => {
    const data = adicionarDias(base, index);
    return { data, dia: data.getDate(), outroMes: false };
  });
}

function ocorreReserva(reserva: Reserva, data: Date): boolean {
  const iso = formatarISO(data);
  if (iso < reserva.dataInicio || iso > reserva.dataFim) return false;
  if (!reserva.diasSemana?.length) return true;
  return reserva.diasSemana.includes(diaSemanaISO(data));
}

function obterTipoTurno(turno: string, semTurma = false): TurnoVisual {
  if (semTurma) return 'avul';
  const t = turno.toLowerCase();
  if (t.includes('ves')) return 'ves';
  if (t.includes('not')) return 'not';
  return 'mat';
}

function formatarISO(data: Date): string {
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  return `${data.getFullYear()}-${mm}-${dd}`;
}

function formatarBR(data: Date): string {
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${data.getFullYear()}`;
}

function nomeDiaCompleto(data: Date): string {
  return ['Domingo', 'Segunda-feira', 'Terca-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sabado'][data.getDay()];
}

function diaSemanaISO(data: Date) {
  return (['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const)[data.getDay()];
}

function zerarHora(data: Date): Date {
  const dt = new Date(data);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function getSegundaFeira(data: Date): Date {
  const dt = zerarHora(data);
  const dow = dt.getDay();
  dt.setDate(dt.getDate() + (dow === 0 ? -6 : 1 - dow));
  return dt;
}

function adicionarDias(data: Date, dias: number): Date {
  const dt = new Date(data);
  dt.setDate(dt.getDate() + dias);
  return dt;
}

function getDotStyle(tipo: TurnoVisual) {
  if (tipo === 'ves') return styles.dotVes;
  if (tipo === 'not') return styles.dotNot;
  if (tipo === 'avul') return styles.dotAvul;
  return styles.dotMat;
}

function getEventStyle(tipo: TurnoVisual) {
  if (tipo === 'ves') return styles.eventVes;
  if (tipo === 'not') return styles.eventNot;
  if (tipo === 'avul') return styles.eventAvul;
  return styles.eventMat;
}

function getEventTextStyle(tipo: TurnoVisual) {
  if (tipo === 'ves') return styles.eventTextVes;
  if (tipo === 'not') return styles.eventTextNot;
  if (tipo === 'avul') return styles.eventTextAvul;
  return styles.eventTextMat;
}

function getDetailStyle(tipo: TurnoVisual) {
  if (tipo === 'ves') return styles.detailVes;
  if (tipo === 'not') return styles.detailNot;
  if (tipo === 'avul') return styles.detailAvul;
  return styles.detailMat;
}

const styles = criarEstilos(() => ({
  container: {
    flex: 1,
  },
  content: {
    padding: 14,
    gap: 14,
    paddingBottom: 24,
  },
  // ---- Navegacao ----
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  periodoWrap: {
    flex: 1,
    alignItems: 'center',
  },
  periodo: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },
  todayBtn: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  todayBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  // ---- Segmentado Mes / Semana ----
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 13,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    color: Colors.text2,
    fontWeight: '800',
    fontSize: 13,
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  // ---- Filtros ----
  filtroBloco: {
    gap: 7,
  },
  filtroLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.text3,
    letterSpacing: 1,
  },
  filterRow: {
    gap: 8,
    paddingRight: 8,
  },
  selectChip: {
    minHeight: 36,
    maxWidth: 160,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
  },
  selectChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  selectChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text2,
  },
  selectChipTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  // ---- Legenda ----
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text2,
  },
  // ---- Grade ----
  calendarCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  weekHeader: {
    flexDirection: 'row',
    height: 34,
    backgroundColor: Colors.surface2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  weekHeaderText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingTop: 9,
    fontSize: 11,
    fontWeight: '900',
    color: Colors.text2,
  },
  weekendText: {
    color: Colors.red,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    minHeight: 76,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    backgroundColor: Colors.surface,
  },
  weekCell: {
    minHeight: 140,
  },
  outMonthCell: {
    backgroundColor: Colors.surface2,
  },
  todayCell: {
    backgroundColor: Colors.primaryLight,
  },
  selectedCell: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  dayTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  outMonthText: {
    color: Colors.text3,
  },
  todayNumber: {
    color: '#ffffff',
    backgroundColor: Colors.primary,
    borderRadius: 11,
    width: 22,
    height: 22,
    textAlign: 'center',
    lineHeight: 22,
    overflow: 'hidden',
    fontWeight: '900',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginLeft: 3,
  },
  eventStack: {
    gap: 3,
  },
  eventPill: {
    height: 16,
    borderRadius: 4,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  eventText: {
    fontSize: 9,
    fontWeight: '800',
  },
  eventMat: {
    backgroundColor: Colors.turno.Matutino.bg,
  },
  eventVes: {
    backgroundColor: Colors.turno.Vespertino.bg,
  },
  eventNot: {
    backgroundColor: Colors.turno.Noturno.bg,
  },
  eventAvul: {
    backgroundColor: Colors.turno.SemTurma.bg,
  },
  eventTextMat: {
    color: Colors.turno.Matutino.text,
  },
  eventTextVes: {
    color: Colors.turno.Vespertino.text,
  },
  eventTextNot: {
    color: Colors.turno.Noturno.text,
  },
  eventTextAvul: {
    color: Colors.turno.SemTurma.text,
  },
  morePill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.bg3,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  moreText: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.text2,
  },
  // ---- Painel do dia ----
  sidePanel: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  sideHeader: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sideDate: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sideTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 3,
  },
  sideBody: {
    padding: 14,
    gap: 14,
  },
  turnoGroup: {
    gap: 8,
  },
  turnoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  turnoTitle: {
    color: Colors.text2,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  turnoCount: {
    marginLeft: 'auto',
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text3,
    backgroundColor: Colors.bg3,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  detailCard: {
    borderLeftWidth: 4,
    borderRadius: 10,
    padding: 11,
    gap: 3,
    backgroundColor: Colors.surface,
  },
  detailMat: {
    borderLeftColor: Colors.turno.Matutino.dot,
    backgroundColor: Colors.turno.Matutino.bg,
  },
  detailVes: {
    borderLeftColor: Colors.turno.Vespertino.dot,
    backgroundColor: Colors.turno.Vespertino.bg,
  },
  detailNot: {
    borderLeftColor: Colors.turno.Noturno.dot,
    backgroundColor: Colors.turno.Noturno.bg,
  },
  detailAvul: {
    borderLeftColor: Colors.turno.SemTurma.dot,
    backgroundColor: Colors.turno.SemTurma.bg,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailRoom: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '900',
    flex: 1,
    marginRight: 6,
  },
  detailLine: {
    color: Colors.text2,
    fontSize: 12,
    fontWeight: '700',
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  detailMuted: {
    color: Colors.text3,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
  },
  emptyText: {
    color: Colors.text3,
    fontSize: 13,
    fontWeight: '700',
  },
  dotMat: {
    backgroundColor: Colors.turno.Matutino.dot,
  },
  dotVes: {
    backgroundColor: Colors.turno.Vespertino.dot,
  },
  dotNot: {
    backgroundColor: Colors.turno.Noturno.dot,
  },
  dotAvul: {
    backgroundColor: Colors.turno.SemTurma.dot,
  },
}));
