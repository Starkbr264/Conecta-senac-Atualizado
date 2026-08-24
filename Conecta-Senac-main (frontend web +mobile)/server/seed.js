/*
 * seed.js
 * Dados iniciais do servidor central (fonte da verdade web + mobile).
 *
 * O conjunto de dados espelha o que o web usava no localStorage, mas agora
 * fica persistido em server/data/db.json. Web e mobile sincronizam contra
 * esta base — por isso os IDs são FIXOS e iguais em todas as plataformas.
 *
 * Estrutura:
 *   unidades    -> 10 unidades SENAC/DF (IDs 1001..1010)
 *   usuarios    -> admin + 10 coordenadores + 20 instrutores + 10 recepcao
 *   salas       -> 50 salas (5 por unidade, IDs 5001..5050)
 *   turmas      -> 40 turmas (4 por unidade, IDs 6001..6040)
 *   reservas    -> 31 reservas recorrentes (IDs 7001..7031)
 *   chaves      -> 20 chaves (2 por unidade, IDs 8001..8020)
 *   notificacoes-> 4 avisos iniciais (IDs 9001..9004)
 *   solicitacoes-> 4 pedidos de sala (IDs 10001..10004)
 */

'use strict';

// ---- Utilitarios de data ------------------------------------------------
const hoje = new Date();
const iso = (d) => d.toISOString().split('T')[0];
const addDias = (n) => { const d = new Date(hoje); d.setDate(d.getDate() + n); return iso(d); };

// ---- Unidades ------------------------------------------------------------
const unidades = [
  { id: 1001, nome: 'SENAC Asa Norte',    cep: '70750-500', cidade: 'Brasília/DF',    endereco: 'SCS Q.3 Bl.A - Asa Norte' },
  { id: 1002, nome: 'SENAC Asa Sul',      cep: '70390-045', cidade: 'Brasília/DF',    endereco: 'SCS Q.3 Bl.A - Asa Sul' },
  { id: 1003, nome: 'SENAC Taguatinga',   cep: '72015-900', cidade: 'Taguatinga/DF',  endereco: 'QS 1 Rua 210 Lote 30' },
  { id: 1004, nome: 'SENAC Ceilândia',    cep: '72220-270', cidade: 'Ceilândia/DF',   endereco: 'Setor O, Qd.602 Conj.A' },
  { id: 1005, nome: 'SENAC Gama',         cep: '72405-080', cidade: 'Gama/DF',        endereco: 'St. Central Qd.01 Conj.A' },
  { id: 1006, nome: 'SENAC Sobradinho',   cep: '73025-500', cidade: 'Sobradinho/DF',  endereco: 'Conj.7 Área Esp. S/N' },
  { id: 1007, nome: 'SENAC Planaltina',   cep: '73380-100', cidade: 'Planaltina/DF',  endereco: 'Setor Comercial Lote 1' },
  { id: 1008, nome: 'SENAC Samambaia',    cep: '72301-080', cidade: 'Samambaia/DF',   endereco: 'QS 318 Conj.1 Lote 1' },
  { id: 1009, nome: 'SENAC Santa Maria',  cep: '72503-503', cidade: 'Santa Maria/DF', endereco: 'Av. Alagados Qd.400' },
  { id: 1010, nome: 'SENAC Águas Claras', cep: '71907-530', cidade: 'Águas Claras/DF',endereco: 'Av. Araras Qd.600 Lote 10' },
];

// ---- Usuarios ------------------------------------------------------------
const coordenadores = [
  ['Anadiria Passos', 'coord.asanorte@senacdf.com', 2001, 1001],
  ['Joao Paulo Ferreira', 'coord.Paulo@senacdf.com', 2002, 1001],
  ['Bruno Mendes Costa', 'coord.asasul@senacdf.com', 2003, 1002],
  ['Carla Souza Lima', 'coord.taguatinga@senacdf.com', 2004, 1003],
  ['Daniel Rocha Neves', 'coord.ceilandia@senacdf.com', 2005, 1004],
  ['Elaine Cristina Dias', 'coord.gama@senacdf.com', 2006, 1005],
  ['Fábio Alves Santos', 'coord.sobradinho@senacdf.com', 2007, 1006],
  ['Gabriela Moura', 'coord.planaltina@senacdf.com', 2008, 1007],
  ['Henrique Lopes', 'coord.samambaia@senacdf.com', 2009, 1008],
  ['Isabela Ramos', 'coord.santamaria@senacdf.com', 2010, 1009],
  ['João Victor Pinto', 'coord.aguasclaras@senacdf.com', 2011, 1010],
].map(([nome, email, id, unidadeId]) => ({ id, nome, email, senha: 'Coord@123', perfil: 'coordenador', unidadeId }));

const instrutores = [
  ['Katia Regina Barros', 'katia.barros@senacdf.com', 3001, 1001],
  ['Aline Moraes', 'aline.moraes@senacdf.com', 3002, 1001],
  ['Leonardo Cruz', 'leonardo.cruz@senacdf.com', 3003, 1002],
  ['Caio Batista', 'caio.batista@senacdf.com', 3004, 1002],
  ['Mariana Oliveira', 'mariana.oliveira@senacdf.com', 3005, 1003],
  ['Diana Castro', 'diana.castro@senacdf.com', 3006, 1003],
  ['Natan Ferreira', 'natan.ferreira@senacdf.com', 3007, 1004],
  ['Erick Almeida', 'erick.almeida@senacdf.com', 3008, 1004],
  ['Olivia Martins', 'olivia.martins@senacdf.com', 3009, 1005],
  ['Fernanda Lima', 'fernanda.lima@senacdf.com', 3010, 1005],
  ['Pedro Henrique Melo', 'pedro.melo@senacdf.com', 3011, 1006],
  ['Gustavo Rocha', 'gustavo.rocha@senacdf.com', 3012, 1006],
  ['Queila Nascimento', 'queila.nascimento@senacdf.com', 3013, 1007],
  ['Helena Duarte', 'helena.duarte@senacdf.com', 3014, 1007],
  ['Rafael Torres', 'rafael.torres@senacdf.com', 3015, 1008],
  ['Igor Martins', 'igor.martins@senacdf.com', 3016, 1008],
  ['Sabrina Almeida', 'sabrina.almeida@senacdf.com', 3017, 1009],
  ['Julia Naves', 'julia.naves@senacdf.com', 3018, 1009],
  ['Thiago Vieira', 'thiago.vieira@senacdf.com', 3019, 1010],
  ['Lucas Teixeira', 'lucas.teixeira@senacdf.com', 3020, 1010],
].map(([nome, email, id, unidadeId]) => ({ id, nome, email, senha: 'Inst@123', perfil: 'instrutor', unidadeId }));

const recepcoes = [
  ['Úrsula Campos', 'recep.asanorte@senacdf.com', 4001, 1001],
  ['Vinícius Cardoso', 'recep.asasul@senacdf.com', 4002, 1002],
  ['Wanda Silveira', 'recep.taguatinga@senacdf.com', 4003, 1003],
  ['Xênia Prudente', 'recep.ceilandia@senacdf.com', 4004, 1004],
  ['Yara Gonçalves', 'recep.gama@senacdf.com', 4005, 1005],
  ['Zilda Fonseca', 'recep.sobradinho@senacdf.com', 4006, 1006],
  ['Adriana Pereira', 'recep.planaltina@senacdf.com', 4007, 1007],
  ['Bernardo Castro', 'recep.samambaia@senacdf.com', 4008, 1008],
  ['Cecília Duarte', 'recep.santamaria@senacdf.com', 4009, 1009],
  ['Diego Farias', 'recep.aguasclaras@senacdf.com', 4010, 1010],
].map(([nome, email, id, unidadeId]) => ({ id, nome, email, senha: 'Recep@123', perfil: 'recepcao', unidadeId }));

const usuarios = [
  { id: 1, nome: 'Administrador SENAC', email: 'Senac_GDF@Hotmail.com', senha: 'Senac.DF2007', perfil: 'admin', unidadeId: 1001 },
  ...coordenadores,
  ...instrutores,
  ...recepcoes,
];

// ---- Salas (50 — 5 por unidade) ------------------------------------------
const TURNOS_ALL = ['Matutino', 'Vespertino', 'Noturno'];
const TIPOS_SALA = [
  'Laboratório de Informática',
  'Sala Comum',
  'Cozinha Didática',
  'Auditório',
  'Sala de Reunião',
];

let salas = [];
let sid = 5000;
unidades.forEach((u, ui) => {
  TIPOS_SALA.forEach((tipo, ti) => {
    sid += 1;
    const numero = String(ui + 1).padStart(2, '0');
    const nomes = [
      `Lab Informática ${numero}`,
      `Sala Comum ${numero}`,
      `Lab Práticas ${numero}`,
      `Auditório ${numero}`,
      `Sala Reunião ${numero}`,
    ];
    const andares = ['1º Andar', 'Térreo', '1º Andar', 'Térreo', '2º Andar'];
    const turnos = (ti === 2 || ti === 4) ? ['Matutino', 'Vespertino'] : TURNOS_ALL;
    salas.push({
      id: sid,
      nome: nomes[ti],
      capacidade: [30, 40, 20, 80, 12][ti],
      tipo,
      andar: andares[ti],
      bloco: `Bloco ${String.fromCharCode(65 + ti)}`,
      turnosDisponiveis: turnos,
      turnos, // compatibilidade com a versao web
      unidadeId: u.id,
      statusManual: null,
      motivoManual: '',
      manualPor: '',
      manualCriadaEm: null,
    });
  });
});

// ---- Turmas (40 — 4 por unidade) ------------------------------------------
const CURSOS = [
  'Técnico em Informática',
  'Gastronomia Básica',
  'Gestão de Pessoas',
  'Técnico em Estética',
  'Redes de Computadores',
  'Auxiliar de Enfermagem',
  'Design Gráfico',
  'Logística',
  'Atendimento ao Cliente',
  'Empreendedorismo',
];
const TURNOS_TURMA = ['Matutino', 'Vespertino', 'Noturno', 'Matutino'];

let turmas = [];
let tid = 6000;
unidades.forEach((u, ui) => {
  for (let k = 0; k < 4; k++) {
    tid += 1;
    const instrutor = instrutores.filter(i => i.unidadeId === u.id)[k % 2];
    turmas.push({
      id: tid,
      codigo: `2025.0${(tid - 6000).toString().padStart(2, '0')}`,
      nome: `2025.${String(ui + 1).padStart(2, '0')}.${(k + 1) * 10 + ui}`,
      curso: CURSOS[(ui + k) % CURSOS.length],
      turno: TURNOS_TURMA[k],
      dataInicio: addDias(-20 + k * 5),
      dataFim: addDias(80 + k * 20),
      instrutorId: instrutor.id,
      unidadeId: u.id,
    });
  }
});

// ---- Reservas (31) --------------------------------------------------------
let reservas = [];
let rid = 7000;
unidades.forEach((u, ui) => {
  const salasU = salas.filter(s => s.unidadeId === u.id);
  const turmasU = turmas.filter(t => t.unidadeId === u.id);
  const padroesDias = [
    ['seg', 'ter', 'qua', 'qui', 'sex'],
    ['seg', 'qua', 'sex'],
    ['ter', 'qui'],
  ];
  for (let k = 0; k < 3; k++) {
    rid += 1;
    const sala = salasU[k % salasU.length];
    const turma = turmasU[k % turmasU.length];
    const turno = turma.turno;
    reservas.push({
      id: rid,
      salaId: sala.id,
      turmaId: turma.id,
      turno,
      diasSemana: padroesDias[k % padroesDias.length],
      dataInicio: addDias(-20 + k * 5),
      dataFim: addDias(80 + k * 20),
      status: 'ATIVA', // compatibilidade com a versao web
      unidadeId: u.id,
      instrutorId: turma.instrutorId,
    });
  }
});
// Reserva cancelada de exemplo (espelha o web)
reservas.push({
  id: 7031, salaId: 5003, turmaId: 6001, turno: 'Vespertino',
  diasSemana: ['sab'], dataInicio: addDias(20), dataFim: addDias(20),
  status: 'CANCELADA', unidadeId: 1001, instrutorId: 3001,
});

// ---- Chaves (20 — 2 por unidade) ------------------------------------------
let chaves = [];
let cid = 8000;
unidades.forEach((u, ui) => {
  const salasU = salas.filter(s => s.unidadeId === u.id);
  for (let k = 0; k < 2; k++) {
    cid += 1;
    const sala = salasU[k % salasU.length];
    chaves.push({
      id: cid,
      codigo: `CH-${String(ui + 1).padStart(2, '0')}${k + 1}`,
      salaId: sala.id,
      andar: sala.andar,
      status: k === 0 ? 'disponivel' : 'pega',
      instrutorId: k === 0 ? null : instrutores.filter(i => i.unidadeId === u.id)[0].id,
      pegaEm: k === 0 ? null : new Date(Date.now() - 3600000).toISOString(),
      unidadeId: u.id,
    });
  }
});

// ---- Notificacoes ----------------------------------------------------------
const notificacoes = [
  { id: 9001, tipo: 'info', titulo: 'Reserva confirmada', msg: 'Turma vinculada a uma sala com sucesso.', mensagem: '', paraPerfil: 'coordenador', paraId: null, unidadeId: 1001, lida: false, criadaEm: new Date(Date.now() - 3600000).toISOString() },
  { id: 9002, tipo: 'aviso', titulo: 'Sala em manutenção', msg: 'Algumas salas podem estar temporariamente indisponíveis.', mensagem: '', paraPerfil: 'recepcao', paraId: null, unidadeId: 1001, lida: false, criadaEm: new Date(Date.now() - 7200000).toISOString() },
  { id: 9003, tipo: 'ok', titulo: 'Solicitação aprovada', msg: 'Uso de sala aprovado para atividade prática.', mensagem: '', paraPerfil: 'instrutor', paraId: 3007, unidadeId: 1004, lida: false, criadaEm: new Date(Date.now() - 10800000).toISOString() },
  { id: 9004, tipo: 'info', titulo: 'Chave retirada', msg: 'Uma chave foi retirada para aula vespertina.', mensagem: '', paraPerfil: 'coordenador', paraId: null, unidadeId: 1005, lida: true, criadaEm: new Date(Date.now() - 14400000).toISOString() },
];

// ---- Solicitacoes ----------------------------------------------------------
const solicitacoes = [
  { id: 10001, salaId: 5005, instrutorId: 3005, unidadeId: 1003, data: addDias(2), turnos: ['Noturno'], motivo: 'Aula extra de portfólio fotográfico', status: 'pendente', criadaEm: new Date(Date.now() - 5400000).toISOString() },
  { id: 10002, salaId: 5012, instrutorId: 3007, unidadeId: 1004, data: addDias(5), turnos: ['Matutino'], turmaId: 6010, motivo: 'Mostra de projetos integradores', status: 'aprovada', criadaEm: new Date(Date.now() - 9000000).toISOString(), respondidaEm: new Date(Date.now() - 3600000).toISOString() },
  { id: 10003, salaId: 5050, instrutorId: 3019, unidadeId: 1010, data: addDias(1), turnos: ['Vespertino'], motivo: 'Atendimento de mentoria para turma', status: 'pendente', criadaEm: new Date(Date.now() - 1800000).toISOString() },
  { id: 10004, salaId: 5047, instrutorId: 3017, unidadeId: 1009, data: addDias(3), turnos: ['Vespertino'], motivo: 'Reposição de conteúdo prático', status: 'recusada', criadaEm: new Date(Date.now() - 12600000).toISOString(), respondidaEm: new Date(Date.now() - 7200000).toISOString(), resposta: 'Sala bloqueada para manutenção.' },
];

// Ordena por id (garante estabilidade entre plataformas)
const sortId = (a, b) => Number(a.id || 0) - Number(b.id || 0);
const seed = {
  usuarios: usuarios.sort(sortId),
  unidades: unidades.sort(sortId),
  salas: salas.sort(sortId),
  turmas: turmas.sort(sortId),
  reservas: reservas.sort(sortId),
  chaves: chaves.sort(sortId),
  notificacoes: notificacoes.sort(sortId),
  solicitacoes: solicitacoes.sort(sortId),
};

module.exports = seed;
