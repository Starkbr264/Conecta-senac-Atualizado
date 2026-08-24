/*
 * TimePickerField.tsx — Seletor de horário do mobile.
 *
 * Componente de formulário usado nos modais do mobile (reservas com hora,
 * solicitações de sala, etc.). Abre um modal com duas colunas roláveis:
 * horas (00–23) e minutos (de 5 em 5), com pré-visualização "HH:mm".
 *
 * O valor trocado com o formulário é "HH:mm" — mesmo formato usado no
 * web — garantindo que horaInicio/horaFim sincronizem corretamente.
 */

import React, { useState } from 'react';
import {
  Modal, ScrollView, Text, TouchableOpacity, View, StyleProp, ViewStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { criarEstilos } from '@/theme/theme';

const HORAS = Array.from({ length: 24 }, (_, i) => i);
const MINUTOS = Array.from({ length: 12 }, (_, i) => i * 5);

const p2 = (n: number): string => String(n).padStart(2, '0');

interface TimePickerFieldProps {
  value: string; // formato "HH:mm"
  onChange: (valor: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}

export default function TimePickerField({ value, onChange, placeholder = 'Selecionar horario', style }: TimePickerFieldProps) {
  const [aberto, setAberto] = useState(false);
  const [hora, setHora] = useState<number | null>(null);
  const [minuto, setMinuto] = useState<number | null>(null);

  const abrir = () => {
    const p = value ? value.split(':').map(Number) : [];
    setHora(p.length === 2 && !isNaN(p[0]) ? p[0] : 8);
    setMinuto(p.length === 2 && !isNaN(p[1]) ? p[1] : 0);
    setAberto(true);
  };

  const confirmar = () => {
    if (hora !== null && minuto !== null) {
      onChange(`${p2(hora)}:${p2(minuto)}`);
    }
    setAberto(false);
  };

  return (
    <>
      <TouchableOpacity style={[styles.campo, style]} onPress={abrir} activeOpacity={0.7}>
        <Text style={value ? styles.texto : styles.placeholder}>
          {value || placeholder}
        </Text>
        <Ionicons name="time-outline" size={18} color={Colors.text3} />
      </TouchableOpacity>

      <Modal visible={aberto} transparent animationType="slide" onRequestClose={() => setAberto(false)}>
        <View style={styles.overlay}>
          <View style={styles.box}>
            <View style={styles.header}>
              <Text style={styles.titulo}>Selecionar horario</Text>
              <TouchableOpacity onPress={() => setAberto(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={Colors.text2} />
              </TouchableOpacity>
            </View>

            <View style={styles.colunas}>
              {/* Coluna de horas */}
              <View style={styles.coluna}>
                <Text style={styles.colTitulo}>Hora</Text>
                <ScrollView style={styles.colLista} showsVerticalScrollIndicator={false}>
                  {HORAS.map(h => {
                    const ativa = hora === h;
                    return (
                      <TouchableOpacity
                        key={h}
                        style={[styles.item, ativa && styles.itemAtivo]}
                        onPress={() => setHora(h)}
                        activeOpacity={0.6}
                      >
                        <Text style={[styles.itemTxt, ativa && styles.itemTxtAtivo]}>{p2(h)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <Text style={styles.separador}>:</Text>

              {/* Coluna de minutos */}
              <View style={styles.coluna}>
                <Text style={styles.colTitulo}>Min</Text>
                <ScrollView style={styles.colLista} showsVerticalScrollIndicator={false}>
                  {MINUTOS.map(m => {
                    const ativa = minuto === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[styles.item, ativa && styles.itemAtivo]}
                        onPress={() => setMinuto(m)}
                        activeOpacity={0.6}
                      >
                        <Text style={[styles.itemTxt, ativa && styles.itemTxtAtivo]}>{p2(m)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            <View style={styles.preview}>
              <Text style={styles.previewTxt}>
                {hora !== null && minuto !== null ? `${p2(hora)}:${p2(minuto)}` : '--:--'}
              </Text>
            </View>

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
  colunas: { flexDirection: 'row', alignItems: 'flex-start' },
  coluna: { flex: 1 },
  colTitulo: { fontSize: 11, fontWeight: '900', color: Colors.text3, textAlign: 'center', marginBottom: 6, textTransform: 'uppercase' },
  colLista: { maxHeight: 240 },
  item: {
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemAtivo: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  itemTxt: { fontSize: 16, fontWeight: '700', color: Colors.text2 },
  itemTxtAtivo: { color: '#fff', fontWeight: '900' },
  separador: { fontSize: 24, fontWeight: '900', color: Colors.text3, marginHorizontal: 10, paddingTop: 30 },
  preview: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
  },
  previewTxt: { fontSize: 24, fontWeight: '900', color: Colors.primary },
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
