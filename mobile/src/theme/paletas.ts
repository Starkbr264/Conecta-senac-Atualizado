// Paletas de cores espelhadas de css/variables.css (tema claro + escuro do web)
export type Paleta = {
  bg: string;
  surface: string;
  surface2: string;
  bg2: string;
  bg3: string;
  border: string;
  border2: string;

  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryDark: string;

  accent: string;
  accentLight: string;

  green: string;
  greenLight: string;
  red: string;
  redLight: string;
  amber: string;
  amberLight: string;
  blue: string;
  blueLight: string;
  purple: string;

  text: string;
  text2: string;
  text3: string;

  r: number;
  rLg: number;

  turno: {
    Matutino: { bg: string; text: string; dot: string };
    Vespertino: { bg: string; text: string; dot: string };
    Noturno: { bg: string; text: string; dot: string };
    SemTurma: { bg: string; text: string; dot: string };
  };
  status: {
    livre: { bg: string; text: string; dot: string; border: string };
    ocupada: { bg: string; text: string; dot: string; border: string };
    iminente: { bg: string; text: string; dot: string; border: string };
  };
  turmaStatus: {
    ativa: { bg: string; text: string; border: string };
    iminente: { bg: string; text: string; border: string };
    posterior: { bg: string; text: string; border: string };
    encerrada: { bg: string; text: string; border: string };
  };
};

export const paletaClara: Paleta = {
  bg: '#f5f7fa',
  surface: '#ffffff',
  surface2: '#f9fafb',
  bg2: '#f0f4f8',
  bg3: '#e8edf2',
  border: '#e8edf2',
  border2: '#d1d9e0',

  primary: '#1a3a5c',
  primaryHover: '#0f2640',
  primaryLight: '#eaf1fb',
  primaryDark: '#0f2640',

  accent: '#f59e0b',
  accentLight: '#fef3c7',

  green: '#059669',
  greenLight: '#d1fae5',
  red: '#dc2626',
  redLight: '#fee2e2',
  amber: '#d97706',
  amberLight: '#fef3c7',
  blue: '#2563eb',
  blueLight: '#dbeafe',
  purple: '#8b5cf6',

  text: '#1a2332',
  text2: '#4a5568',
  text3: '#8fa3b8',

  r: 10,
  rLg: 16,

  turno: {
    Matutino: { bg: '#fef3c7', text: '#92400e', dot: '#d97706' },
    Vespertino: { bg: '#dbeafe', text: '#1e40af', dot: '#2563eb' },
    Noturno: { bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
    SemTurma: { bg: '#fed7aa', text: '#9a3412', dot: '#f97316' },
  },
  status: {
    livre: { bg: '#d1fae5', text: '#065f46', dot: '#059669', border: '#6ee7b7' },
    ocupada: { bg: '#fee2e2', text: '#991b1b', dot: '#dc2626', border: '#fca5a5' },
    iminente: { bg: '#fef3c7', text: '#92400e', dot: '#d97706', border: '#fcd34d' },
  },
  turmaStatus: {
    ativa: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
    iminente: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
    posterior: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
    encerrada: { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' },
  },
};

export const paletaEscura: Paleta = {
  bg: '#060d16',
  surface: '#0d1826',
  surface2: '#111f30',
  bg2: '#0a1522',
  bg3: '#111f30',
  border: '#182840',
  border2: '#1e3350',

  primary: '#4a9eff',
  primaryHover: '#2e7de0',
  primaryLight: 'rgba(74,158,255,0.16)',
  primaryDark: 'rgba(74,158,255,0.08)',

  accent: '#f59e0b',
  accentLight: 'rgba(245,158,11,0.16)',

  green: '#10b981',
  greenLight: 'rgba(5,150,105,0.18)',
  red: '#f87171',
  redLight: 'rgba(220,38,38,0.18)',
  amber: '#fbbf24',
  amberLight: 'rgba(217,119,6,0.18)',
  blue: '#60a5fa',
  blueLight: 'rgba(37,99,235,0.18)',
  purple: '#a78bfa',

  text: '#dce8f5',
  text2: '#7a9bb8',
  text3: '#3d5570',

  r: 10,
  rLg: 16,

  turno: {
    Matutino: { bg: 'rgba(217,119,6,0.2)', text: '#fcd34d', dot: '#fbbf24' },
    Vespertino: { bg: 'rgba(37,99,235,0.2)', text: '#93c5fd', dot: '#60a5fa' },
    Noturno: { bg: 'rgba(139,92,246,0.2)', text: '#c4b5fd', dot: '#a78bfa' },
    SemTurma: { bg: 'rgba(249,115,22,0.2)', text: '#fdba74', dot: '#fb923c' },
  },
  status: {
    livre: { bg: 'rgba(5,150,105,0.18)', text: '#6ee7b7', dot: '#10b981', border: 'rgba(16,185,129,0.5)' },
    ocupada: { bg: 'rgba(220,38,38,0.18)', text: '#fca5a5', dot: '#f87171', border: 'rgba(248,113,113,0.5)' },
    iminente: { bg: 'rgba(217,119,6,0.18)', text: '#fcd34d', dot: '#fbbf24', border: 'rgba(251,191,36,0.5)' },
  },
  turmaStatus: {
    ativa: { bg: 'rgba(5,150,105,0.18)', text: '#6ee7b7', border: 'rgba(16,185,129,0.4)' },
    iminente: { bg: 'rgba(217,119,6,0.18)', text: '#fcd34d', border: 'rgba(251,191,36,0.4)' },
    posterior: { bg: 'rgba(37,99,235,0.18)', text: '#93c5fd', border: 'rgba(147,197,253,0.4)' },
    encerrada: { bg: 'rgba(100,116,139,0.12)', text: '#64748b', border: 'rgba(100,116,139,0.3)' },
  },
};
