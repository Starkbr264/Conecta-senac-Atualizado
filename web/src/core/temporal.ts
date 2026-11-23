import { buscarConfiguracaoTemporal, type ConfiguracaoTemporal } from './api';

let configuracao: ConfiguracaoTemporal | null = null;
let deslocamentoServidorMs = 0;

export async function carregarConfiguracaoTemporal(): Promise<void> {
  const resposta = await buscarConfiguracaoTemporal();
  const servidorMs = Date.parse(resposta.agora);
  if (!resposta.timezone || !Number.isFinite(servidorMs) || !resposta.turnos) {
    configuracao = null;
    throw new Error('Configuracao temporal invalida');
  }
  configuracao = resposta;
  deslocamentoServidorMs = servidorMs - Date.now();
}

export function classificarTurno(
  data: string,
  turno: string,
  horaInicio?: string | null,
  horaFim?: string | null,
): string | null {
  if (!configuracao) return 'Configuração temporal indisponível';
  const partes = partesAgora();
  const hoje = `${partes.year}-${partes.month}-${partes.day}`;
  if (data !== hoje) return data < hoje ? 'Data passada' : null;

  const intervalo = horaInicio && horaFim
    ? { inicio: horaInicio, fim: horaFim }
    : configuracao.turnos[String(turno).toLowerCase()];
  if (!intervalo) return null;
  const minutosAgora = Number(partes.hour) * 60 + Number(partes.minute);
  const [inicioHora, inicioMinuto] = intervalo.inicio.split(':').map(Number);
  const [fimHora, fimMinuto] = intervalo.fim.split(':').map(Number);
  const inicio = inicioHora * 60 + inicioMinuto;
  const fim = fimHora * 60 + fimMinuto;
  if (minutosAgora >= fim) return 'Turno encerrado';
  if (minutosAgora >= inicio) return 'Turno em andamento';
  return null;
}

export function hojeTemporalISO(): string {
  const partes = partesAgora();
  return `${partes.year}-${partes.month}-${partes.day}`;
}

function partesAgora(): Record<string, string> {
  if (!configuracao) return {};
  const agora = new Intl.DateTimeFormat('en-CA', {
    timeZone: configuracao.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(Date.now() + deslocamentoServidorMs));
  return Object.fromEntries(agora.map((parte) => [parte.type, parte.value]));
}

export function temConfiguracaoTemporal(): boolean {
  return configuracao !== null;
}
