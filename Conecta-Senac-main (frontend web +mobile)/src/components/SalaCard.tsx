/*
 * SalaCard.tsx — Cartão de sala usado no mapa de salas do mobile.
 *
 * Réplica do .sala-card-v2 do web:
 *   - Borda e fundo na cor do status (verde=livre, vermelho=ocupada,
 *     âmbar=iminente);
 *   - Mostra nome, tipo, andar/bloco/capacidade e os turnos disponíveis;
 *   - Abaixo, lista os períodos de ocupação do dia (turno + turma +
 *     instrutor + horário) ou o selo "Disponível".
 *
 * As informações de status vêm de calcSalaInfo() (salaStatus.ts), que usa
 * as reservas sincronizadas com o servidor central — as mesmas do web.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Sala, StatusSala } from '@/types';

// Período de ocupação de uma sala (turno + turma + instrutor)
export type Periodo = {
  turno: string;
  turmaNome: string;
  instNome: string | null;
  stat: 'ocupada' | 'iminente';
  hora?: string;
};

export type SalaInfo = {
  stat: StatusSala;
  periodos: Periodo[];
};

// Card de sala — replica exata do .sala-card-v2 do web
export function SalaCard({ sala, info }: { sala: Sala; info: SalaInfo }) {
  const sc = Colors.status[info.stat];
  const turnos = sala.turnosDisponiveis ?? [];

  return (
    <View style={[styles.card, { borderColor: sc.dot, backgroundColor: sc.bg }]}>
      {/* Header: nome + bolinha de status */}
      <View style={styles.header}>
        <Text style={styles.nome}>{sala.nome}</Text>
        <View style={[styles.statusDot, { backgroundColor: sc.dot }]} />
      </View>
      <Text style={styles.tipo}>{sala.tipo}</Text>

      {/* Meta: andar, bloco, capacidade */}
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Ionicons name="business-outline" size={13} color={Colors.text3} />
          <Text style={styles.metaTxt}>{sala.andar}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="location-outline" size={13} color={Colors.text3} />
          <Text style={styles.metaTxt}>{sala.bloco}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="people-outline" size={13} color={Colors.text3} />
          <Text style={styles.metaTxt}>{sala.capacidade}</Text>
        </View>
      </View>

      {/* Chips de turnos disponiveis */}
      <View style={styles.turnos}>
        {turnos.map(t => {
          const per = info.periodos.find(p => p.turno === t);
          const ocupado = per?.stat === 'ocupada';
          const iminente = per?.stat === 'iminente';
          return (
            <View
              key={t}
              style={[
                styles.turnoChip,
                ocupado && { backgroundColor: Colors.redLight, borderColor: Colors.red },
                iminente && { backgroundColor: Colors.amberLight, borderColor: Colors.amber },
              ]}
            >
              <Text style={[
                styles.turnoChipTxt,
                ocupado && { color: Colors.red },
                iminente && { color: Colors.amber },
              ]}>{t[0]}</Text>
            </View>
          );
        })}
      </View>

      {/* Ocupacao detalhada ou label de disponivel */}
      {info.periodos.length > 0 ? (
        <View style={styles.ocupacao}>
          {info.periodos.map((per, i) => (
            <View key={i} style={styles.periodo}>
              <View style={styles.periodoTurnoRow}>
                <View style={[styles.dot, { backgroundColor: per.stat === 'ocupada' ? Colors.red : Colors.amber }]} />
                <Text style={[styles.periodoTurno, { color: per.stat === 'ocupada' ? Colors.red : Colors.amber }]}>
                  {per.turno}
                </Text>
              </View>
              {per.turmaNome === 'Sem turma' ? (
                <View style={styles.semTurmaBadge}>
                  <Text style={styles.semTurmaTxt}>Sem turma</Text>
                </View>
              ) : (
                <View style={styles.turmaRow}>
                  <Ionicons name="book-outline" size={12} color={Colors.text2} />
                  <Text style={styles.turmaTxt}>{per.turmaNome}</Text>
                </View>
              )}
              {per.instNome ? (
                <View style={styles.turmaRow}>
                  <Ionicons name="person-outline" size={12} color={Colors.text3} />
                  <Text style={styles.instTxt}>{per.instNome}</Text>
                </View>
              ) : null}
              {per.hora ? (
                <View style={styles.turmaRow}>
                  <Ionicons name="time-outline" size={12} color={Colors.text3} />
                  <Text style={styles.instTxt}>{per.hora}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.livreRow}>
          <View style={[styles.dot, { backgroundColor: Colors.green }]} />
          <Text style={styles.livreTxt}>Disponivel</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 2, borderRadius: Colors.rLg, padding: 14, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nome: { fontSize: 15, fontWeight: '800', color: Colors.text, flex: 1 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  tipo: { fontSize: 12, color: Colors.text3, marginTop: 2, marginBottom: 10 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  metaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  metaTxt: { fontSize: 11, color: Colors.text2, fontWeight: '600' },
  turnos: { flexDirection: 'row', gap: 5, marginBottom: 10 },
  turnoChip: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: Colors.border2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.5)',
  },
  turnoChipTxt: { fontSize: 12, fontWeight: '700', color: Colors.text3 },
  ocupacao: { gap: 8 },
  periodo: {
    backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: 8,
    borderLeftWidth: 3, borderLeftColor: Colors.border2,
  },
  periodoTurnoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  periodoTurno: { fontSize: 12, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  turmaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  turmaTxt: { fontSize: 12, color: Colors.text2, fontWeight: '600' },
  instTxt: { fontSize: 11, color: Colors.text3 },
  semTurmaBadge: { backgroundColor: Colors.turno.SemTurma.bg, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, marginTop: 2 },
  semTurmaTxt: { fontSize: 10, fontWeight: '700', color: Colors.turno.SemTurma.text },
  livreRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  livreTxt: { fontSize: 13, fontWeight: '600', color: '#065f46' },
});
