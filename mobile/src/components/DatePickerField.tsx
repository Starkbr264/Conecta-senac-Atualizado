/*
 * DatePickerField.tsx — Seletor de data do mobile.
 *
 * Componente de formulário usado nos modais do mobile (turmas, reservas,
 * solicitações de sala, etc.). Abre um calendário mensal em um modal:
 *   - Navegação por mês (setas) e destaque do dia de hoje;
 *   - Dias fora do mês ficam apagados;
 *   - Suporta minDate/maxDate para desabilitar datas fora do intervalo.
 *
 * O valor trocado com o formulário é uma data em ISO (AAAA-MM-DD), o mesmo
 * formato usado pelo web — garantindo compatibilidade na sincronização.
 */

import React, { useMemo, useState } from 'react';
import {
  Modal, ScrollView, Text, TouchableOpacity, View, StyleProp, ViewStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { criarEstilos } from '@/theme/theme';

const MESES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

type DiaGrade = { data: Date; dia: number; outroMes: boolean };

interface DatePickerFieldProps {
  value: string; // ISO AAAA-MM-DD
  onChange: (iso: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  minDate?: string; // ISO — dias anteriores ficam desabilitados
  maxDate?: string; // ISO — dias posteriores ficam desabilitados
}

function formatarISO(data: Date): string {
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  return `${data.getFullYear()}-${mm}-${dd}`;
}

function formatarBR(iso: string): string {
  if (!iso) return '';
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

function montarDias(ano: number, mes: number): DiaGrade[] {
  const primeiro = new Date(ano, mes, 1);
  const offset = (primeiro.getDay() + 6) % 7; // semana comecando no domingo
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const prevTotal = new Date(ano, mes, 0).getDate();
  const dias: DiaGrade[] = [];

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
  return dias;
}

export default function DatePickerField({ value, onChange, placeholder = 'Selecionar data', style, minDate, maxDate }: DatePickerFieldProps) {
  const hoje = new Date();
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [selecionada, setSelecionada] = useState<string>(value);

  const dias = useMemo(() => montarDias(ano, mes), [ano, mes]);
  const hojeISO = formatarISO(hoje);

  const abrir = () => {
    if (value) {
      const p = value.split('-').map(Number);
      if (p.length === 3 && !isNaN(p[0])) {
        setAno(p[0]);
        setMes(p[1] - 1);
      }
    }
    setSelecionada(value);
    setAberto(true);
  };

  const navegar = (delta: number) => {
    setMes(prev => {
      const novoMes = prev + delta;
      if (novoMes < 0) { setAno(a => a - 1); return 11; }
      if (novoMes > 11) { setAno(a => a + 1); return 0; }
      return novoMes;
    });
  };

  const desabilitado = (iso: string, outroMes: boolean) => {
    if (outroMes) return true;
    if (minDate && iso < minDate) return true;
    if (maxDate && iso > maxDate) return true;
    return false;
  };

  const confirmar = () => {
    if (selecionada) onChange(selecionada);
    setAberto(false);
  };

  return (
    <>
      <TouchableOpacity style={[styles.campo, style]} onPress={abrir} activeOpacity={0.7}>
        <Text style={value ? styles.texto : styles.placeholder}>
          {value ? formatarBR(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={Colors.text3} />
      </TouchableOpacity>

      <Modal visible={aberto} transparent animationType="slide" onRequestClose={() => setAberto(false)}>
        <View style={styles.overlay}>
          <View style={styles.box}>
            <View style={styles.header}>
              <Text style={styles.titulo}>Selecionar data</Text>
              <TouchableOpacity onPress={() => setAberto(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={Colors.text2} />
              </TouchableOpacity>
            </View>

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.navBtn} onPress={() => navegar(-1)} hitSlop={8} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.mesAno}>{MESES[mes]} {ano}</Text>
              <TouchableOpacity style={styles.navBtn} onPress={() => navegar(1)} hitSlop={8} activeOpacity={0.7}>
                <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {DIAS_SEMANA.map(d => (
                <Text key={d} style={[styles.weekTxt, d === 'DOM' && { color: Colors.red }]}>{d}</Text>
              ))}
            </View>

            <ScrollView style={{ maxHeight: 260 }}>
              <View style={styles.grid}>
                {dias.map(item => {
                  const iso = formatarISO(item.data);
                  const ativa = iso === selecionada;
                  const des = desabilitado(iso, item.outroMes);
                  const ehHoje = iso === hojeISO && !item.outroMes;
                  return (
                    <TouchableOpacity
                      key={iso}
                      disabled={des}
                      onPress={() => setSelecionada(iso)}
                      activeOpacity={0.6}
                      style={[
                        styles.diaCell,
                        item.outroMes && styles.diaOutro,
                        ehHoje && styles.diaHoje,
                        ativa && styles.diaAtiva,
                        des && styles.diaDesabilitado,
                      ]}
                    >
                      <Text style={[styles.diaTxt, item.outroMes && styles.diaTxtOutro, ehHoje && styles.diaTxtHoje, ativa && styles.diaTxtAtiva, des && styles.diaTxtDesabilitado]}>
                        {item.dia}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.acoes}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setAberto(false)} activeOpacity={0.8}>
                <Text style={styles.btnGhostTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimario} onPress={confirmar} activeOpacity={0.8}>
                <Ionicons name="checkmark" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.btnPrimarioTxt}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = criarEstilos(() => ({
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 46,
  },
  texto: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  placeholder: { fontSize: 14, color: Colors.text3 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  box: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  titulo: { fontSize: 16, fontWeight: '800', color: Colors.text },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface,
  },
  mesAno: { fontSize: 16, fontWeight: '900', color: Colors.text },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekTxt: {
    width: `${100 / 7}%`, textAlign: 'center',
    fontSize: 10, fontWeight: '900', color: Colors.text3,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  diaCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1.15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  diaOutro: { opacity: 0.35 },
  diaHoje: { backgroundColor: Colors.primaryLight },
  diaAtiva: { backgroundColor: Colors.primary },
  diaDesabilitado: { opacity: 0.25 },
  diaTxt: { fontSize: 14, fontWeight: '700', color: Colors.text },
  diaTxtOutro: { color: Colors.text3 },
  diaTxtHoje: { color: Colors.primary, fontWeight: '900' },
  diaTxtAtiva: { color: '#fff', fontWeight: '900' },
  diaTxtDesabilitado: { color: Colors.text3 },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btnGhost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: 'transparent',
  },
  btnGhostTxt: { fontSize: 14, fontWeight: '700', color: Colors.text2 },
  btnPrimario: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  btnPrimarioTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
}));
