// ═══════════════════════════════════════
//  DATA STORE (will connect to Supabase)
// ═══════════════════════════════════════
let CLINICA = {
  nome: 'Clínica Maria Cecília',
  cnpj: '12.345.678/0001-90',
  endereco: 'Rua das Flores, 123 — São Paulo, SP',
  telefone: '(11) 3456-7890',
  email: '',
  codPrestador: '0001234',
  cnes: '',
  logo: '',         // base64 da imagem
  canalNotif: 'whatsapp', // 'whatsapp' | 'chat'
};

// ── Espaço Conecta — dados globais (declarados aqui para ficarem disponíveis para todos os scripts) ──
let SALAS_CONECTA      = [];
let LOCATARIOS         = [];
let RESERVAS_SALAS     = [];
let FECHAMENTOS_CONECTA = [];

// ── Persistência local do Espaço Conecta ─────────────────────────────────
function _conectaSalvarLocal() {
  try {
    localStorage.setItem('cf_conecta_salas',     JSON.stringify(SALAS_CONECTA));
    localStorage.setItem('cf_conecta_locs',      JSON.stringify(LOCATARIOS));
    localStorage.setItem('cf_conecta_reservas',  JSON.stringify(RESERVAS_SALAS));
    localStorage.setItem('cf_conecta_fechamentos', JSON.stringify(FECHAMENTOS_CONECTA));
  } catch(e) { console.warn('[Conecta] Erro ao salvar local:', e); }
}
function _conectaCarregarLocal() {
  try {
    const s = localStorage.getItem('cf_conecta_salas');
    const l = localStorage.getItem('cf_conecta_locs');
    const r = localStorage.getItem('cf_conecta_reservas');
    const f = localStorage.getItem('cf_conecta_fechamentos');
    if (s) { SALAS_CONECTA.length = 0;       JSON.parse(s).forEach(x => SALAS_CONECTA.push(x)); }
    if (l) { LOCATARIOS.length = 0;           JSON.parse(l).forEach(x => LOCATARIOS.push(x)); }
    if (r) { RESERVAS_SALAS.length = 0;       JSON.parse(r).forEach(x => RESERVAS_SALAS.push(x)); }
    if (f) { FECHAMENTOS_CONECTA.length = 0;  JSON.parse(f).forEach(x => FECHAMENTOS_CONECTA.push(x)); }
  } catch(e) { console.warn('[Conecta] Erro ao carregar local:', e); }
}
window._conectaSalvarLocal  = _conectaSalvarLocal;
window._conectaCarregarLocal = _conectaCarregarLocal;
let CS_WEEK_OFFSET = 0;
let RESERVA_ATUAL_ID = null;

// USUARIOS é declarado e inicializado no módulo Usuários & Acesso (script block abaixo)

const PROFISSIONAIS = [];

const PACIENTES = [
  // Dados demo removidos — carregados do Supabase ao fazer login
  // (mantidos vazios para evitar conflito com dados reais do banco)
];

let PLANOS = [
  { id:5, nome:'Particular', nomeGuia:'PARTICULAR', cnpj:'', ans:'', tabela:'Própria', codPrestador:'', nomeContratado:'', cnes:'', numGuiaInicial:1, usaTiss:false, aplicaTodos:true, tipoId:'Código', versaoTiss:'4.02.00', tel:'', email:'', obs:'', status:'Ativo', pacientes:0, juntarGuia:true, nomePlanoGuia:'' },
];

const TUSS_TABLE = {
  '50000136': { desc:'Avaliação / Anamnese',         valor:180.00 },
  '50000195': { desc:'Sessão de Fonoaudiologia',     valor:130.00 },
  '50000209': { desc:'Psicoterapia individual',      valor:160.00 },
  '50000217': { desc:'Psicopedagogia – sessão',      valor:150.00 },
  '50000225': { desc:'Terapia Ocupacional – sessão', valor:145.00 },
  '50000233': { desc:'Consulta de retorno',          valor:120.00 },
  '40301013': { desc:'Fonoterapia – grupo',          valor:90.00  },
  '50000470': { desc:'Sessão de Psicoterapia Individual por Psicólogo', valor:59.66 },
};

// Tabela de procedimentos (editável)
let PROCEDIMENTOS = [];
let nextProcId = 1;

// IDs para novos registros
let nextPacId  = 1;
let nextPrfId  = 1;
let nextPlId   = 1;
// Editing state
let editingPacId  = null;
let editingPrfId  = null;
let editingPlId   = null;
let editingProcId = null;

// ─── GUIAS SADT ───────────────────────────────────────────────────────────────
let GUIAS = [];
let nextGuiaId  = 1;

// ─── SENHAS / AUTORIZAÇÕES POR PLANO ─────────────────────────────────────────
let SENHAS_PLANO = [];
let nextSenhaId  = 1;
let editingSenhaId = null;
let editingGuiaId = null;

// ─── LOTES TISS ────────────────────────────────────────────────────────────────
let LOTES = [];
let nextLoteId  = 1;
let editingLoteId = null;

// ─── LISTA DE ESPERA ──────────────────────────────────────────────────────────
let LISTA_ESPERA = [];
let nextEsperaId = 1;
let editingEsperaId = null;

// ─── HISTÓRICO / PRONTUÁRIO ───────────────────────────────────────────────────
let HISTORICO = [];
let nextHistId = 1;
let historicoAtualPacId = null; // paciente aberto no módulo

const APPOINTMENTS = [];

// ═══════════════════════════════════════
//  STATE
// ═══════════════════════════════════════
let currentUser  = null;
let currentView  = 'dia';
let currentDate  = new Date();
let dashDate     = new Date(); // data selecionada no dashboard (independente da agenda)
let activeProfFilters = new Set();
let selectedColor = '#4f8ef7';
let currentApptId = null; // agendamento aberto no modal
let procRowCount  = 1;    // controle de linhas de procedimento SADT
