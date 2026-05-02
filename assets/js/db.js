// ═══════════════════════════════════════
//  SINCRONIZAR DADOS — botão do topbar
//  Relê todos os dados do Supabase sem
//  logout, mantendo a tela atual aberta
// ═══════════════════════════════════════
async function sincronizarDados() {
  const btn  = document.getElementById('btn-sync-dados');
  const icon = document.getElementById('sync-icon');
  if (!btn) return;

  // Verifica se Supabase está conectado
  const sb = window._cfGetDb ? window._cfGetDb() : null;
  if (!sb) {
    showToast('Supabase não conectado — configure as credenciais em Configurações', 'error');
    return;
  }

  // Inicia animação
  btn.classList.add('syncing');
  btn.title = 'Sincronizando...';

  try {
    // ── Função de busca paginada (mesma do loadFromSupabase) ──────────────
    const fetchAll = async (query, orderCol, asc = true) => {
      const PAGE = 1000; let all = [], from = 0, hasMore = true;
      while (hasMore) {
        const q = asc
          ? query.order(orderCol).range(from, from + PAGE - 1)
          : query.order(orderCol, { ascending: false }).range(from, from + PAGE - 1);
        const { data, error } = await q;
        if (error) throw error;
        if (data && data.length > 0) { all = all.concat(data); from += PAGE; hasMore = data.length === PAGE; }
        else hasMore = false;
      }
      return all;
    };

    // ── Mapas de conversão (referencia os do Supabase patch) ──────────────
    const m = window._cfMap || {};
    const rep = (arr, data, fn) => { arr.length = 0; (data || []).forEach(r => arr.push(fn(r))); };

    // ── Busca paralela de todas as tabelas ────────────────────────────────
    const [prof, pl, proc, lo, se, esp, cfg] = await Promise.all([
      sb.from('profissionais').select('*').order('nome').limit(5000),
      sb.from('planos_saude').select('*').order('nome').limit(500),
      sb.from('procedimentos').select('*').order('descricao').limit(5000),
      sb.from('lotes_tiss').select('*').order('created_at', { ascending: false }).limit(2000),
      sb.from('senhas_plano').select('*').order('created_at', { ascending: false }).limit(5000),
      sb.from('lista_espera').select('*').order('created_at', { ascending: false }).limit(2000),
      sb.from('config_clinica').select('*').limit(1),
    ]);
    const pac  = await fetchAll(sb.from('pacientes').select('*'),  'nome');
    const ag   = await fetchAll(sb.from('agendamentos').select('*'), 'data_iso');
    const gu   = await fetchAll(sb.from('guias_sadt').select('*'),  'created_at', false);
    const hist = await fetchAll(sb.from('historico').select('*'),   'data', false);

    // ── Atualiza arrays em memória ────────────────────────────────────────
    if (m.dbToPac)   rep(PACIENTES,    pac,       m.dbToPac);
    if (m.dbToProf)  rep(PROFISSIONAIS,prof.data, m.dbToProf);
    if (m.dbToPlano) rep(PLANOS,       pl.data,   m.dbToPlano);
    if (m.dbToProc)  rep(PROCEDIMENTOS,proc.data, m.dbToProc);
    if (m.dbToAppt)  rep(APPOINTMENTS, ag,        m.dbToAppt);
    if (m.dbToGuia)  rep(GUIAS,        gu,        m.dbToGuia);
    if (m.dbToLote)  rep(LOTES,        lo.data,   m.dbToLote);
    if (m.dbToSenha) rep(SENHAS_PLANO, se.data,   m.dbToSenha);
    if (m.dbToEspera)rep(LISTA_ESPERA, esp.data,  m.dbToEspera);
    if (m.dbToHist)  rep(HISTORICO,    hist,      m.dbToHist);
    if (cfg.data && cfg.data.length > 0) Object.assign(CLINICA, cfg.data[0].dados || {});

    // Carrega usuários do Supabase (merge com localStorage)
    try { if (typeof carregarUsuariosSupabase === 'function') await carregarUsuariosSupabase(); } catch(_eu) {}
    // Carrega bloqueios de agenda do Supabase
    try { if (typeof _carregarBloqueiosSupabase === 'function') await _carregarBloqueiosSupabase(sb); } catch(_eb) {}

    // Recalcula próximos IDs
    const maxId = arr => arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;
    nextPacId    = maxId(PACIENTES);
    nextPrfId    = maxId(PROFISSIONAIS);
    nextPlId     = maxId(PLANOS);
    nextProcId   = maxId(PROCEDIMENTOS);
    nextGuiaId   = maxId(GUIAS);
    nextLoteId   = maxId(LOTES);
    nextSenhaId  = maxId(SENHAS_PLANO);
    nextEsperaId = maxId(LISTA_ESPERA);
    nextHistId   = maxId(HISTORICO);
    activeProfFilters = new Set(getProfisComAgendaHoje().map(p => p.id));

    // ── Atualiza toda a UI ────────────────────────────────────────────────
    refreshUI();

    // Feedback visual de sucesso
    btn.classList.remove('syncing');
    btn.classList.add('success');
    btn.title = 'Dados sincronizados ✓';
    showToast('✓ Dados sincronizados — ' + PACIENTES.length + ' pacientes · ' + APPOINTMENTS.length + ' agendamentos', 'success');
    setTimeout(() => {
      btn.classList.remove('success');
      btn.title = 'Sincronizar dados do banco de dados';
    }, 3000);

  } catch (e) {
    btn.classList.remove('syncing');
    btn.title = 'Sincronizar dados do banco de dados';
    showToast('Erro ao sincronizar: ' + e.message, 'error');
    console.error('[Sync]', e);
  }
}


<script>
// ═══════════════════════════════════════════════════════════════════════
//  SUPABASE INTEGRATION — ClinicFlow
//  Patch integrado inline (não precisa de supabase_patch.js externo)
// ═══════════════════════════════════════════════════════════════════════

// ── Singleton global: evita múltiplos GoTrueClient no mesmo contexto ─────────
// Deve ser definido ANTES da IIFE para que getDb() e outros módulos possam usar
;(function _definirSingletonSupabase() {
  let _cachedClient = null;
  window._cfGetOrCreateClient = function(url, key) {
    if (_cachedClient) return _cachedClient;
    if (window.__cfSb) { _cachedClient = window.__cfSb; return _cachedClient; }
    if (!window.supabase || !url || !key) return null;
    _cachedClient = window.supabase.createClient(url, key);
    window.__cfSb = _cachedClient;
    return _cachedClient;
  };
})();

(function () {
  'use strict';

  let _sb = null;

  function getDb() {
    if (_sb) return _sb;
    if (window.__cfSb) { _sb = window.__cfSb; return _sb; }
    const url = localStorage.getItem('cf_supa_url');
    const key = localStorage.getItem('cf_supa_key');
    if (url && key && window._cfGetOrCreateClient) {
      _sb = window._cfGetOrCreateClient(url, key);
    }
    return _sb;
  }

  // Expõe getDb globalmente para módulos externos (WA, Notif, etc.)
  window.getDb = getDb;

  const map = {
    pacToDb: p => ({ nome:p.nome, nasc:p.nasc||null, cpf:p.cpf||null, tel:p.tel||null, email:p.email||null, end:p.end||null, plano_id:p.planoId||5, plano:p.plano||'Particular', carteirinha:p.carteirinha||null, sexo:p.sexo||null, status:p.status||'Ativo', obs:p.obs||null, ultima:p.ultima||null, est_civil:p.estCivil||null, profissao:p.profissao||null, titular:p.titular||null, foto:p.foto||null }),
    dbToPac: r => ({ id:r.id, nome:r.nome, nasc:r.nasc||'', cpf:r.cpf||'', tel:r.tel||'', email:r.email||'', end:r.end||'', planoId:r.plano_id||5, plano:r.plano||'Particular', carteirinha:r.carteirinha||'—', sexo:r.sexo||'', status:r.status||'Ativo', obs:r.obs||'', ultima:r.ultima||'', estCivil:r.est_civil||'', profissao:r.profissao||'', titular:r.titular||'', foto:r.foto||'' }),
    profToDb: p => ({ nome:p.nome, nome_agenda:p.nomeAgenda||null, esp:p.esp||null, conselho:p.conselho||null, num:p.num||null, uf:p.uf||'SP', cbo:p.cbo||null, tel:p.tel||null, email:p.email||null, cor:p.cor||'#4f8ef7', status:p.status||'Ativo', instagram:p.instagram||null, linkedin:p.linkedin||null, google_cal_id:p.googleCalendarId||null, foto:p.foto||null, valor_30:p.valor30||0, valor_60:p.valor60||0, valor_aval:p.valorAval||0 }),
    dbToProf: r => ({ id:r.id, nome:r.nome, nomeAgenda:r.nome_agenda||r.nome?.split(' ')[0]||'', esp:r.esp||'', conselho:r.conselho||'', num:r.num||'', uf:r.uf||'SP', cbo:r.cbo||'', tel:r.tel||'', email:r.email||'', cor:r.cor||'#4f8ef7', status:r.status||'Ativo', instagram:r.instagram||'', linkedin:r.linkedin||'', googleCalendarId:r.google_cal_id||'', foto:r.foto||'', valor30:r.valor_30||0, valor60:r.valor_60||0, valorAval:r.valor_aval||0 }),
    planoToDb: p => ({ nome:p.nome, nome_guia:p.nomeGuia||null, cnpj:p.cnpj||null, ans:p.ans||null, tabela:p.tabela||'CBHPM', cod_prestador:p.codPrestador||null, nome_contratado:p.nomeContratado||null, cnes:p.cnes||null, num_guia_inicial:p.numGuiaInicial||1, usa_tiss:p.usaTiss!==false, aplica_todos:p.aplicaTodos!==false, tipo_id:p.tipoId||'Código', versao_tiss:p.versaoTiss||'4.02.00', tel:p.tel||null, email:p.email||null, obs:p.obs||null, status:p.status||'Ativo', pacientes:p.pacientes||0, juntar_guia:p.juntarGuia!==false, nome_plano_guia:p.nomePlanoGuia||null, logo:p.logo||null }),
    dbToPlano: r => ({ id:r.id, nome:r.nome, nomeGuia:r.nome_guia||'', cnpj:r.cnpj||'', ans:r.ans||'', tabela:r.tabela||'CBHPM', codPrestador:r.cod_prestador||'', nomeContratado:r.nome_contratado||'', cnes:r.cnes||'', numGuiaInicial:r.num_guia_inicial||1, usaTiss:r.usa_tiss!==false, aplicaTodos:r.aplica_todos!==false, tipoId:r.tipo_id||'Código', versaoTiss:r.versao_tiss||'4.02.00', tel:r.tel||'', email:r.email||'', obs:r.obs||'', status:r.status||'Ativo', pacientes:r.pacientes||0, juntarGuia:r.juntar_guia!==false, nomePlanoGuia:r.nome_plano_guia||'', logo:r.logo||null }),
    procToDb: p => ({ codigo:p.codigo||null, descricao:p.desc, desc_curta:p.descCurta||null, tipo:p.tipo||'Sessão', val_part:p.valPart||0, val_plano:p.valPlano||0, tabela:p.tabela||'TUSS', plano_id:p.planoId||0, status:p.status||'Ativo', obs:p.obs||null }),
    dbToProc: r => ({ id:r.id, codigo:r.codigo||'', desc:r.descricao||r.desc||'', descCurta:r.desc_curta||'', tipo:r.tipo||'Sessão', valPart:r.val_part||0, valPlano:r.val_plano||0, tabela:r.tabela||'TUSS', planoId:r.plano_id||0, status:r.status||'Ativo', obs:r.obs||'' }),
    apptToDb: a => ({ prof_id:a.profId, paciente:a.paciente, plano:a.plano||'Particular', plano_id:a.planoId||5, hora:a.hora, hora_fim:a.horaFim||null, dur_min:a.durMin||30, data_iso:a.dataISO||null, status:a.status||'agendado', obs:a.obs||null, modalidade:a.modalidade||'presencial', meet_link:a.meetLink||null, wa_sent:a.waSent||false, carteirinha:a.carteirinha||null, guia:a.guia||null }),
    dbToAppt: r => ({ id:r.id, profId:r.prof_id, paciente:r.paciente, plano:r.plano||'Particular', planoId:r.plano_id, hora:r.hora, horaFim:r.hora_fim||'', durMin:r.dur_min||30, dataISO:r.data_iso||'', status:r.status||'agendado', obs:r.obs||'', modalidade:r.modalidade||'presencial', meetLink:r.meet_link||'', waSent:r.wa_sent||false, carteirinha:r.carteirinha||'', guia:r.guia||null }),
    guiaToDb: g => ({ num:g.num, pac:g.pac, plano_id:g.planoId, plano:g.plano, prof_id:g.profId, valor:g.valor||0, status:g.status||'Pendente', data:g.data||null, lote_id:g.loteId||null, lote_num:g.loteNum||null, dados:g.dados||null, carteirinha:g.carteirinha||null, num_op:g.numOp||null, cid:g.cid||null }),
    dbToGuia: r => ({ id:r.id, num:r.num, pac:r.pac, planoId:r.plano_id, plano:r.plano, profId:r.prof_id, valor:r.valor||0, status:r.status||'Pendente', data:r.data||'', loteId:r.lote_id||null, loteNum:r.lote_num||null, dados:r.dados||{}, carteirinha:r.carteirinha||'', numOp:r.num_op||'', cid:r.cid||'' }),
    loteToDb: l => ({ num:l.num, competencia:l.competencia, plano_id:l.planoId, plano:l.plano, qtd:l.qtd||0, valor:l.valor||0, status:l.status||'Pendente', data_criacao:l.dataCriacao||null, data_envio:l.dataEnvio||null, obs:l.obs||null, guia_ids:l.guiaIds||[] }),
    dbToLote: r => ({ id:r.id, num:r.num, competencia:r.competencia, planoId:r.plano_id, plano:r.plano, qtd:r.qtd||0, valor:r.valor||0, status:r.status||'Pendente', dataCriacao:r.data_criacao||'', dataEnvio:r.data_envio||'', obs:r.obs||'', guiaIds:r.guia_ids||[], xml:'' }),
    senhaToDb: s => ({ plano_id:s.planoId, paciente:s.paciente, carteirinha:s.carteirinha||null, num_guia_op:s.numGuiaOp||null, num_senha:s.numSenha, data_aut:s.dataAut||null, validade:s.validade||null, qtd_autorizada:s.qtdAutorizada||10, qtd_usada:s.qtdUsada||0, cid:s.cid||null, obs:s.obs||null, status:s.status||'Ativa', procs:s.procs||null, ativa:s.ativa!==false }),
    dbToSenha: r => ({ id:r.id, planoId:r.plano_id, paciente:r.paciente, carteirinha:r.carteirinha||'', numGuiaOp:r.num_guia_op||'', numSenha:r.num_senha, dataAut:r.data_aut||'', validade:r.validade||'', qtdAutorizada:r.qtd_autorizada||10, qtdUsada:r.qtd_usada||0, cid:r.cid||'', obs:r.obs||'', status:r.status||'Ativa', procs:r.procs||[], ativa:r.ativa!==false }),
    esperaToDb: e => ({ nome:e.nome, tel:e.tel, email:e.email||null, nasc:e.nasc||null, end:e.end||null, plano:e.plano||null, carteirinha:e.carteirinha||null, obs:e.obs||null, dias:e.dias||[], periodos:e.periodos||[], procedimentos:e.procedimentos||[], status:e.status||'Aguardando', data_entrada:e.dataEntrada||null }),
    dbToEspera: r => ({ id:r.id, nome:r.nome, tel:r.tel||'', email:r.email||'', nasc:r.nasc||'', end:r.end||'', plano:r.plano||'', carteirinha:r.carteirinha||'', obs:r.obs||'', dias:r.dias||[], periodos:r.periodos||[], procedimentos:r.procedimentos||[], status:r.status||'Aguardando', dataEntrada:r.data_entrada||'' }),
    histToDb: h => ({ pac_id:h.pacId, tipo:h.tipo, titulo:h.titulo||null, conteudo:h.conteudo||null, prof_id:h.profId||null, data:h.data||null, status:h.status||null, fonte:h.fonte||null }),
    dbToHist: r => ({ id:r.id, pacId:r.pac_id, tipo:r.tipo, titulo:r.titulo||'', conteudo:r.conteudo||{}, profId:r.prof_id||null, data:r.data||'', status:r.status||'', fonte:r.fonte||'' }),
  };

  // ── Busca paginada — contorna o limite de 1000 registros do PostgREST ──────
  async function fetchAll(query, orderCol, ascending = true) {
    const PAGE = 1000;
    let all = [], from = 0, hasMore = true;
    while (hasMore) {
      const q = ascending
        ? query.order(orderCol).range(from, from + PAGE - 1)
        : query.order(orderCol, { ascending: false }).range(from, from + PAGE - 1);
      const { data, error } = await q;
      if (error) throw error;
      if (data && data.length > 0) {
        all = all.concat(data);
        from += PAGE;
        hasMore = data.length === PAGE; // se retornou exato 1000, pode ter mais
      } else {
        hasMore = false;
      }
    }
    return all;
  }

  async function loadFromSupabase() {
    const sb = getDb();
    if (!sb) return;
    showToast('Carregando dados do banco de dados...', 'success');
    try {
      // Tabelas grandes (pacientes, agendamentos, historico) usam paginação
      // Tabelas pequenas (planos, profissionais, etc.) usam query simples com limit alto
      const [prof, pl, proc, lo, se, esp, cfg] = await Promise.all([
        sb.from('profissionais').select('*').order('nome').limit(5000),
        sb.from('planos_saude').select('*').order('nome').limit(500),
        sb.from('procedimentos').select('*').order('descricao').limit(5000),
        sb.from('lotes_tiss').select('*').order('created_at', { ascending: false }).limit(2000),
        sb.from('senhas_plano').select('*').order('created_at', { ascending: false }).limit(5000),
        sb.from('lista_espera').select('*').order('created_at', { ascending: false }).limit(2000),
        sb.from('config_clinica').select('*').limit(1),
      ]);

      // Tabelas grandes: paginação completa
      const pac  = await fetchAll(sb.from('pacientes').select('*'),  'nome');
      const ag   = await fetchAll(sb.from('agendamentos').select('*'), 'data_iso');
      const gu   = await fetchAll(sb.from('guias_sadt').select('*'),  'created_at', false);
      const hist = await fetchAll(sb.from('historico').select('*'),   'data', false);

      const rep = (arr, data, fn) => { arr.length = 0; (data || []).forEach(r => arr.push(fn(r))); };
      rep(PACIENTES,    pac,        map.dbToPac);
      rep(PROFISSIONAIS,prof.data,  map.dbToProf);
      rep(PLANOS,       pl.data,    map.dbToPlano);
      rep(PROCEDIMENTOS,proc.data,  map.dbToProc);
      rep(APPOINTMENTS, ag,         map.dbToAppt);
      rep(GUIAS,        gu,         map.dbToGuia);
      rep(LOTES,        lo.data,    map.dbToLote);
      rep(SENHAS_PLANO, se.data,    map.dbToSenha);
      rep(LISTA_ESPERA, esp.data,   map.dbToEspera);
      rep(HISTORICO,    hist,       map.dbToHist);
      if (cfg.data && cfg.data.length > 0) {
        Object.assign(CLINICA, cfg.data[0].dados || {});
        // Sincroniza canal de notificação carregado do banco
        if (CLINICA.canalNotif) {
          WA_CONFIG.canal = CLINICA.canalNotif;
          localStorage.setItem('cf_notif_canal', CLINICA.canalNotif);
        }
      }

      // Carrega usuários do Supabase (merge com localStorage)
      try { await carregarUsuariosSupabase(); } catch(_eu) {}

      const maxId = (arr) => arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;
      nextPacId    = maxId(PACIENTES);
      nextPrfId    = maxId(PROFISSIONAIS);
      nextPlId     = maxId(PLANOS);
      nextProcId   = maxId(PROCEDIMENTOS);
      nextGuiaId   = maxId(GUIAS);
      nextLoteId   = maxId(LOTES);
      nextSenhaId  = maxId(SENHAS_PLANO);
      nextEsperaId = maxId(LISTA_ESPERA);
      nextHistId   = maxId(HISTORICO);
      activeProfFilters = new Set(getProfisComAgendaHoje().map(p => p.id));

      // Re-render all modules via refreshUI central
      try { refreshUI(); } catch(e) {
        // Fallback caso refreshUI ainda não esteja definida no momento do load inicial
        ['renderPacientesTable','renderProfissionaisTable','renderPlanosGrid','renderProcedimentosTable',
         'renderGuiasList','renderLotesTable','renderSenhas','buildProfFilters',
         'populateSelects','renderDayView','renderSidebarLogo','renderDashboard','renderRelatorios',
         'updateNavBadges'].forEach(fn => { try { window[fn](); } catch(e2) {} });
      }

      showToast('✓ ' + PACIENTES.length + ' pacientes · ' + APPOINTMENTS.length + ' agendamentos carregados', 'success');
      // Atualiza avatar da sidebar com foto do usuário logado (se cadastrada)
      try { if (typeof atualizarAvatarSidebar === 'function') atualizarAvatarSidebar(); } catch(_e2) {}
    } catch (e) {
      showToast('Erro ao carregar dados: ' + e.message, 'error');
      console.error('[ClinicFlow Supabase]', e);
    }
  }

  async function salvarConfigNoDB() {
    const sb = getDb();
    if (!sb) return;
    try {
      const { data } = await sb.from('config_clinica').select('id').limit(1);
      if (data && data.length > 0) await sb.from('config_clinica').update({ dados: CLINICA }).eq('id', data[0].id);
      else await sb.from('config_clinica').insert([{ dados: CLINICA }]);
    } catch(e) { console.error('[ClinicFlow Supabase] salvarConfig:', e); }
  }

  // ── Supabase: carrega dados após _finalizarLogin via initApp ───────────────
  // O patch de interceptação do doLogin foi removido.
  // O carregamento do Supabase ocorre em initApp(), chamado por _finalizarLogin().
  console.log('[ClinicFlow Supabase] Integração Supabase pronta (login autenticado) ✓');
  // hook de login removido — autenticação agora feita em doLogin()

  // ── Override salvarPaciente ───────────────────────────────────────────────
  window.salvarPaciente = async function () {
    const nome = document.getElementById('pac-nome').value.trim();
    if (!nome) { showToast('Informe o nome do paciente', 'error'); return; }
    const planoId = parseInt(document.getElementById('pac-plano').value) || 5;
    const planoObj = PLANOS.find(pl => pl.id === planoId);
    const dados = {
      nome, nasc: document.getElementById('pac-nasc').value, cpf: document.getElementById('pac-cpf').value,
      tel: document.getElementById('pac-tel').value, email: document.getElementById('pac-email').value,
      end: document.getElementById('pac-end').value, planoId, plano: planoObj ? planoObj.nome : 'Particular',
      carteirinha: document.getElementById('pac-carteirinha').value || '—',
      valCart: document.getElementById('pac-val-cart')?.value, titular: document.getElementById('pac-titular').value,
      sexo: document.getElementById('pac-sexo').value, estCivil: document.getElementById('pac-estcivil').value,
      profissao: document.getElementById('pac-profissao').value, obs: document.getElementById('pac-obs').value,
      status: document.getElementById('pac-status').value, ultima: new Date().toLocaleDateString('pt-BR'),
      foto: document.getElementById('pac-foto-data')?.value || '',
    };
    const sb = getDb();
    if (editingPacId !== null) {
      if (sb) await sb.from('pacientes').update(map.pacToDb(dados)).eq('id', editingPacId);
      Object.assign(PACIENTES.find(p => p.id === editingPacId), dados);
      showToast('Paciente atualizado!', 'success');
    } else {
      if (sb) {
        const { data, error } = await sb.from('pacientes').insert([map.pacToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = nextPacId++; }
      PACIENTES.push(dados);
      showToast('Paciente cadastrado!', 'success');
    }
    closeModal('modal-paciente'); refreshUI({ skipHistorico: true });
  };

  // ── Override salvarProfissional ───────────────────────────────────────────
  window.salvarProfissional = async function () {
    const nome = document.getElementById('prf-nome').value.trim();
    if (!nome) { showToast('Informe o nome', 'error'); return; }
    const _pcf = id => parseFloat((document.getElementById(id)?.value||'0').replace(/[R$\s.]/g,'').replace(',','.')) || 0;
    const dados = {
      nome, nomeAgenda: document.getElementById('prf-nome-agenda').value.trim() || nome.split(' ')[0],
      esp: document.getElementById('prf-esp').value, conselho: document.getElementById('prf-conselho').value,
      num: document.getElementById('prf-num-conselho').value, uf: document.getElementById('prf-uf').value,
      cbo: document.getElementById('prf-cbo').value, tel: document.getElementById('prf-tel').value,
      email: document.getElementById('prf-email').value, instagram: document.getElementById('prf-instagram').value,
      linkedin: document.getElementById('prf-linkedin').value,
      googleCalendarId: document.getElementById('prf-google-cal-id').value.trim(),
      cor: selectedColor || '#4f8ef7', status: document.getElementById('prf-status').value,
      foto: document.getElementById('prf-foto-data')?.value || '',
      valor30:   _pcf('prf-valor-30'),
      valor60:   _pcf('prf-valor-60'),
      valorAval: _pcf('prf-valor-aval'),
    };
    const sb = getDb();
    if (editingPrfId !== null) {
      if (sb) await sb.from('profissionais').update(map.profToDb(dados)).eq('id', editingPrfId);
      Object.assign(PROFISSIONAIS.find(p => p.id === editingPrfId), dados);
      showToast('Profissional atualizado!', 'success');
    } else {
      if (sb) {
        const { data, error } = await sb.from('profissionais').insert([map.profToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = nextPrfId++; }
      PROFISSIONAIS.push(dados);
      activeProfFilters.add(dados.id);
      showToast('Profissional cadastrado!', 'success');
    }
    closeModal('modal-profissional'); refreshUI({ skipHistorico: true });
  };

  // ── Override salvarPlano ──────────────────────────────────────────────────
  window.salvarPlano = async function () {
    const nome = document.getElementById('pl-nome').value.trim();
    if (!nome) { showToast('Informe o nome', 'error'); return; }
    const _gf = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const dados = {
      nome, nomeGuia: _gf('pl-nome-guia'), cnpj: _gf('pl-cnpj'), ans: _gf('pl-ans'),
      tabela: _gf('pl-tabela') || 'CBHPM', tel: _gf('pl-tel'), email: _gf('pl-email'),
      codPrestador: _gf('pl-cod-prestador'), nomeContratado: _gf('pl-nome-contratado'),
      cnes: _gf('pl-cnes'), numGuiaInicial: parseInt(_gf('pl-num-guia-inicial')) || 1,
      nomePlanoGuia: _gf('pl-nome-plano-guia'), obs: _gf('pl-obs'), status: _gf('pl-status') || 'Ativo',
      versaoTiss: _gf('pl-versao-tiss') || '4.02.00', tipoId: _gf('pl-tipo-id') || 'Código',
      usaTiss: _gf('pl-usa-tiss') === 'true', aplicaTodos: _gf('pl-aplica-todos') === 'true',
      juntarGuia: _gf('pl-juntar-guia') === 'true', pacientes: 0,
      logo: _plLogoData || null,  // base64 do logo
    };
    const sb = getDb();
    if (editingPlId !== null) {
      const pl = PLANOS.find(p => p.id === editingPlId);
      if (pl) {
        dados.pacientes = pl.pacientes;
        // Preserva logo existente se não foi alterada
        if (!_plLogoData && pl.logo) dados.logo = pl.logo;
        Object.assign(pl, dados);
      }
      if (sb) await sb.from('planos_saude').update(map.planoToDb(dados)).eq('id', editingPlId);
      showToast('Plano atualizado!', 'success');
    } else {
      if (sb) {
        const { data, error } = await sb.from('planos_saude').insert([map.planoToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = nextPlId++; }
      PLANOS.push(dados);
      showToast('Plano cadastrado!', 'success');
    }
    closeModal('modal-plano'); refreshUI({ skipHistorico: true });
  };

  // ── Override salvarProcedimento ───────────────────────────────────────────
  window.salvarProcedimento = async function () {
    const codigo = (document.getElementById('proc-codigo').value || '').trim();
    const desc = (document.getElementById('proc-desc').value || '').trim();
    if (!desc) { showToast('Informe a descrição', 'error'); return; }
    const planoId = parseInt(document.getElementById('proc-plano-id')?.value || '0') || 0;
    const dados = {
      codigo, desc, descCurta: document.getElementById('proc-desc-curta').value,
      tipo: document.getElementById('proc-tipo').value,
      valPart: parseBRL(document.getElementById('proc-val-part').value),
      valPlano: parseBRL(document.getElementById('proc-val-plano').value),
      tabela: document.getElementById('proc-tabela-ref').value, planoId,
      status: document.getElementById('proc-status').value, obs: document.getElementById('proc-obs').value,
    };
    const sb = getDb();
    if (editingProcId !== null) {
      if (sb) await sb.from('procedimentos').update(map.procToDb(dados)).eq('id', editingProcId);
      Object.assign(PROCEDIMENTOS.find(p => p.id === editingProcId), dados);
      showToast('Procedimento atualizado!', 'success');
    } else {
      if (sb) {
        const { data, error } = await sb.from('procedimentos').insert([map.procToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = nextProcId++; }
      PROCEDIMENTOS.push(dados);
      if (codigo) TUSS_TABLE[codigo] = { desc, valor: dados.valPlano };
      showToast('Procedimento cadastrado!', 'success');
    }
    closeModal('modal-procedimento'); refreshUI({ skipHistorico: true });
  };

  // ── Override salvarAgendamento ────────────────────────────────────────────
  window.salvarAgendamento = async function () {
    // Redireciona para salvamento em grupo se modo grupo estiver ativo e for novo agendamento
    if (typeof _grupoMode !== 'undefined' && _grupoMode && !currentApptId) {
      salvarAgendamentoGrupo();
      return;
    }
    const pac = (document.getElementById('ag-paciente').value || '').trim();
    if (!pac) { showToast('Informe o nome do paciente', 'error'); return; }
    const horaIni = document.getElementById('ag-hora-ini').value;
    const horaFim = document.getElementById('ag-hora-fim').value;
    const profId = parseInt(document.getElementById('ag-profissional').value);
    const planoId = parseInt(document.getElementById('ag-plano').value);
    const planoObj = PLANOS.find(p => p.id === planoId);
    const novoStatus = document.getElementById('ag-status').value;
    const dados = {
      profId, paciente: pac, plano: planoObj?.nome || 'Particular', planoId: planoId || 5,
      hora: horaIni, horaFim, durMin: calcDurMin(horaIni, horaFim),
      dataISO: document.getElementById('ag-data')?.value || '',
      status: novoStatus, obs: document.getElementById('ag-obs')?.value || '',
      modalidade: document.querySelector('input[name="ag-modalidade"]:checked')?.value || 'presencial',
      meetLink: document.getElementById('ag-meet-link')?.value || '',
      carteirinha: document.getElementById('ag-carteirinha')?.value || '',
      waSent: false, guia: null,
    };
    const sb = getDb();
    if (currentApptId) {
      const temSadt = document.getElementById('sadt-beneficiario')?.value;
      if (temSadt) {
        const tot = parseFloat((document.getElementById('sadt-total')?.textContent || '0').replace(/[R$\s]/g, '').replace(',', '.')) || 0;
        const numSenha  = document.getElementById('sadt-senha')?.value || '';
        const numGuiaOp = document.getElementById('sadt-autorizacao')?.value || '';
        dados.guia = { autorizacao: numGuiaOp || numSenha || 'Pendente', total: tot, senha: numSenha };
        // Cria guia SADT no banco quando há valor
        if (sb && tot > 0) {
          // Verifica se já existe guia para este agendamento — se sim, atualiza em vez de criar
          const guiaExistente = GUIAS.find(g =>
            g.pac === dados.paciente && g.data === dados.dataISO && g.planoId === dados.planoId
          );
          if (guiaExistente) {
            // Atualiza guia existente
            sb.from('guias_sadt').update({ valor: tot, plano: dados.plano, plano_id: dados.planoId })
              .eq('id', guiaExistente.id).then(({error:ue}) => {
                if (ue) console.error('[Guia UPDATE]', ue.message);
              });
            guiaExistente.valor = tot;
            guiaExistente.plano = dados.plano;
            guiaExistente.planoId = dados.planoId;
            renderGuiasList();
          } else {
          const guiaNum = document.getElementById('sadt-guia-prestador')?.value || ('G' + Date.now().toString().slice(-8));
          const procsAg = [];
          for (let i = 0; i < 5; i++) {
            const codEl  = document.getElementById('sadt-proc-cod-'  + i);
            const descEl = document.getElementById('sadt-proc-desc-' + i);
            if (codEl?.value || descEl?.value)
              procsAg.push({ codigo: codEl?.value||'', desc: descEl?.value||'' });
          }
          const cartGuiaAg = document.getElementById('ag-carteirinha')?.value ||
            PACIENTES.find(p => p.nome === dados.paciente)?.carteirinha?.replace('—','') || null;
          sb.from('guias_sadt').insert([{
            num: guiaNum, pac: dados.paciente,
            plano_id: dados.planoId || null, plano: dados.plano,
            prof_id: dados.profId || null, valor: tot, status: 'Pendente',
            data: dados.dataISO || null,
            carteirinha: cartGuiaAg || null,
            num_op: numGuiaOp || numSenha || null,
            cid: document.getElementById('sadt-cid')?.value || null,
            dados: { procs: procsAg, senha: numSenha }
          }]).select('id').single().then(({data:gd, error:ge}) => {
            if (ge) console.error('[Agendamento Guia INSERT]', ge.message);
            else if (gd) {
              GUIAS.push({ id:gd.id, num:guiaNum, pac:dados.paciente,
                planoId:dados.planoId, plano:dados.plano, profId:dados.profId,
                valor:tot, status:'Pendente', data:dados.dataISO||'',
                carteirinha: cartGuiaAg, numOp: numGuiaOp || numSenha || '',
                loteId:null, dados:{procs:procsAg} });
              renderGuiasList();
            }
          });
          } // end else (guia não existente)
          // Atualiza qtdUsada na senha
          const senhaAppt = SENHAS_PLANO.find(s =>
            s.ativa && s.planoId === dados.planoId &&
            s.paciente.toLowerCase() === dados.paciente.toLowerCase() &&
            s.qtdUsada < s.qtdAutorizada
          );
          if (senhaAppt) {
            senhaAppt.qtdUsada = (senhaAppt.qtdUsada || 0) + 1;
            if (senhaAppt.qtdUsada >= senhaAppt.qtdAutorizada) {
              senhaAppt.status = 'Usada'; senhaAppt.ativa = false;
            }
            sb.from('senhas_plano').update({
              qtd_usada: senhaAppt.qtdUsada, status: senhaAppt.status, ativa: senhaAppt.ativa
            }).eq('id', senhaAppt.id);
          }
        }
      }
      if (sb) await sb.from('agendamentos').update(map.apptToDb(dados)).eq('id', currentApptId);
      const appt = APPOINTMENTS.find(a => a.id === currentApptId);
      if (appt) Object.assign(appt, dados);
      const msgs = { agendado:'Agendamento atualizado!', confirmado:'Consulta confirmada!', atendido:'Marcado como atendido!', chegou:'Paciente em espera!', desmarcado:'Consulta desmarcada.', cancelado:'Agendamento cancelado.' };
      showToast(msgs[novoStatus] || 'Agendamento salvo!', ['desmarcado','cancelado'].includes(novoStatus) ? 'error' : 'success');
    } else {
      if (sb) {
        const { data, error } = await sb.from('agendamentos').insert([map.apptToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = Math.max(...APPOINTMENTS.map(a => a.id), 0) + 1; }
      APPOINTMENTS.push(dados);
      try { updateNavBadges(); } catch(e) {}
      showToast('Agendamento criado!', 'success');
      // Envio automático de notificação pelo canal configurado
      enviarNotifAgendamento(dados);
    }
    closeModal('modal-agendamento'); refreshUI();
  };

  // ── Override updateStatus ─────────────────────────────────────────────────
  window.updateStatus = async function (id, status) {
    const appt = APPOINTMENTS.find(a => a.id === id);
    if (!appt) return;
    appt.status = status;
    const sb = getDb();
    if (sb) await sb.from('agendamentos').update({ status }).eq('id', id);
    if (status === 'atendido') try { registrarAtendimento(id); } catch (e) {}
    const msgs = { confirmado:'Consulta confirmada!', atendido:'Marcado como atendido!', chegou:'Paciente em espera!', desmarcado:'Consulta desmarcada.', cancelado:'Agendamento cancelado.' };
    showToast(msgs[status] || 'Status atualizado.', ['desmarcado','cancelado'].includes(status) ? 'error' : 'success');
    refreshUI();
  };

  // ── Override cancelarAgendamento ──────────────────────────────────────────
  window.cancelarAgendamento = async function () {
    if (!currentApptId) return;
    const appt = APPOINTMENTS.find(a => a.id === currentApptId);
    if (!appt) return;
    appt.status = 'cancelado';
    const sb = getDb();
    if (sb) await sb.from('agendamentos').update({ status: 'cancelado' }).eq('id', currentApptId);
    closeModal('modal-agendamento'); refreshUI();
    showToast('Agendamento cancelado.', 'error');
  };

  // ── Override salvarGuia ───────────────────────────────────────────────────
  window.salvarGuia = async function () {
    const pac = document.getElementById('g-pac')?.value.trim();
    const planoId = parseInt(document.getElementById('g-plano')?.value || '0');
    if (!pac) { showToast('Informe o beneficiário', 'error'); return; }
    if (!planoId) { showToast('Selecione o plano', 'error'); return; }
    const plano = PLANOS.find(p => p.id === planoId);
    const profId = parseInt(document.getElementById('g-prof')?.value || '0');
    const procs = [];
    document.querySelectorAll('.sadt-proc-row').forEach(row => {
      const i = row.dataset.idx;
      const desc = document.getElementById('g-proc-desc-' + i)?.value || '';
      const val = parseBRL(document.getElementById('g-proc-val-' + i)?.value || '0');
      const qtd = parseInt(document.getElementById('g-proc-qtd-' + i)?.value || 1);
      if (desc) procs.push({ codigo: document.getElementById('g-proc-cod-' + i)?.value || '', desc, qtd, valor: val, total: val * qtd });
    });
    const total = procs.reduce((s, p) => s + p.total, 0);
    const dados = {
      pac, planoId, plano: plano?.nome || '—', profId, valor: total,
      carteirinha: document.getElementById('g-carteirinha')?.value || '',
      numOp: document.getElementById('g-num-op')?.value || '',
      cid: document.getElementById('g-cid')?.value || '',
      status: document.getElementById('g-status')?.value || 'Pendente',
      data: document.getElementById('g-data')?.value || '',
      dados: { procs }, loteId: null,
    };
    const sb = getDb();
    if (editingGuiaId !== null) {
      if (sb) await sb.from('guias_sadt').update(map.guiaToDb(dados)).eq('id', editingGuiaId);
      const g = GUIAS.find(x => x.id === editingGuiaId);
      if (g) { Object.assign(g, dados); g.num = document.getElementById('g-num').value; }
      showToast('Guia atualizada!', 'success');
    } else {
      dados.num = document.getElementById('g-num').value || ('G' + Date.now().toString().slice(-8));
      if (sb) {
        const { data, error } = await sb.from('guias_sadt').insert([map.guiaToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = nextGuiaId++; }
      GUIAS.push(dados);
      showToast('Guia SADT criada!', 'success');
    }
    closeModal('modal-guia'); refreshUI({ skipHistorico: true });
  };

  // ── Override salvarLote ───────────────────────────────────────────────────
  window.salvarLote = async function () {
    const planoId = parseInt(document.getElementById('lote-plano')?.value || '0');
    const comp = document.getElementById('lote-competencia')?.value.trim();
    if (!planoId) { showToast('Selecione o plano', 'error'); return; }
    const plano = PLANOS.find(p => p.id === planoId);
    const checkboxes = document.querySelectorAll('#lote-guias-disponiveis input[type=checkbox]:checked');
    const selectedIds = [...checkboxes].map(c => parseInt(c.dataset.guiaId));
    if (!selectedIds.length) { showToast('Selecione ao menos uma guia', 'error'); return; }
    const total = [...checkboxes].reduce((s, c) => s + parseFloat(c.dataset.valor || 0), 0);
    const sb = getDb();
    const obs = document.getElementById('lote-obs')?.value || '';

    if (editingLoteId !== null) {
      const l = LOTES.find(x => x.id === editingLoteId);
      if (l) { l.competencia = comp; l.planoId = planoId; l.plano = plano?.nome || '—'; l.qtd = selectedIds.length; l.valor = total; l.obs = obs; }
      if (sb) await sb.from('lotes_tiss').update(map.loteToDb(l)).eq('id', editingLoteId);
      showToast('Lote atualizado!', 'success');
      closeModal('modal-lote'); refreshUI({ skipHistorico: true });
      return;
    }

    // ── Divisão automática em sublotes de até 90 guias ──────────────────────
    const MAX_POR_LOTE = 90;
    const ano = new Date().getFullYear();
    const valorPorId = {};
    [...checkboxes].forEach(c => { valorPorId[parseInt(c.dataset.guiaId)] = parseFloat(c.dataset.valor || 0); });
    const lotesCriados = [];

    for (let i = 0; i < selectedIds.length; i += MAX_POR_LOTE) {
      const chunk = selectedIds.slice(i, i + MAX_POR_LOTE);
      const chunkValor = chunk.reduce((s, id) => s + (valorPorId[id] || 0), 0);
      const num = String(ano) + String(nextLoteId).padStart(4, '0');
      const newLote = { id: nextLoteId++, num, competencia: comp, planoId, plano: plano?.nome || '—', qtd: chunk.length, valor: chunkValor, status: 'Pendente', dataCriacao: new Date().toISOString().slice(0, 10), dataEnvio: '', obs, guiaIds: chunk, xml: '' };
      if (sb) {
        const { data, error } = await sb.from('lotes_tiss').insert([map.loteToDb(newLote)]).select().single();
        if (error) { showToast('Erro ao criar lote: ' + error.message, 'error'); return; }
        newLote.id = data.id;
      }
      LOTES.push(newLote);
      chunk.forEach(id => {
        const g = GUIAS.find(x => x.id === id);
        if (g) { g.loteId = newLote.id; g.loteNum = newLote.num; g.status = 'Enviado'; const sb2 = getDb(); if (sb2) sb2.from('guias_sadt').update({ lote_id: newLote.id, lote_num: newLote.num, status: 'Enviado' }).eq('id', id); }
      });
      lotesCriados.push(newLote);
    }

    if (lotesCriados.length === 1) {
      showToast('Lote ' + lotesCriados[0].num + ' criado com ' + lotesCriados[0].qtd + ' guias!', 'success');
    } else {
      showToast(lotesCriados.length + ' lotes criados automaticamente (' + selectedIds.length + ' guias divididas em grupos de até 90)!', 'success');
    }
    closeModal('modal-lote'); refreshUI({ skipHistorico: true });
  };

  // ── Override salvarSenha ──────────────────────────────────────────────────
  window.salvarSenha = async function () {
    const planoId = parseInt(document.getElementById('sen-plano')?.value || '0');
    const paciente = document.getElementById('sen-paciente')?.value.trim();
    const numSenha = document.getElementById('sen-num-senha')?.value.trim();
    if (!planoId) { showToast('Selecione o plano', 'error'); return; }
    if (!paciente) { showToast('Informe o paciente', 'error'); return; }
    if (!numSenha) { showToast('Informe a senha', 'error'); return; }
    const procs = [];
    document.querySelectorAll('.sen-proc-row').forEach(row => {
      const i = row.dataset.idx;
      const cod = document.getElementById('sen-proc-cod-' + i)?.value || '';
      const desc = document.getElementById('sen-proc-desc-' + i)?.value || '';
      if (cod || desc) procs.push({ codigo: cod, desc });
    });
    const dados = { planoId, paciente, carteirinha: document.getElementById('sen-carteirinha')?.value || '', numGuiaOp: document.getElementById('sen-num-guia-op')?.value || '', numSenha, dataAut: document.getElementById('sen-data-aut')?.value || '', validade: document.getElementById('sen-validade')?.value || '', qtdAutorizada: parseInt(document.getElementById('sen-qtd-aut')?.value || '10'), qtdUsada: 0, cid: document.getElementById('sen-cid')?.value || '', obs: document.getElementById('sen-obs')?.value || '', status: document.getElementById('sen-status')?.value || 'Ativa', procs, ativa: true };
    const sb = getDb();
    if (editingSenhaId !== null) {
      const s = SENHAS_PLANO.find(x => x.id === editingSenhaId);
      if (s) { dados.qtdUsada = s.qtdUsada; Object.assign(s, dados); }
      if (sb) await sb.from('senhas_plano').update(map.senhaToDb(dados)).eq('id', editingSenhaId);
      showToast('Autorização atualizada!', 'success');
    } else {
      if (sb) {
        const { data, error } = await sb.from('senhas_plano').insert([map.senhaToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = nextSenhaId++; }
      SENHAS_PLANO.push(dados);
      showToast('Autorização cadastrada!', 'success');
    }
    closeModal('modal-senha'); refreshUI({ skipHistorico: true });
  };

  // ── Override salvarEspera ─────────────────────────────────────────────────
  window.salvarEspera = async function () {
    const nome = document.getElementById('esp-nome')?.value.trim();
    const tel = document.getElementById('esp-tel')?.value.trim();
    if (!nome) { showToast('Informe o nome', 'error'); return; }
    if (!tel) { showToast('Informe o telefone', 'error'); return; }
    const dados = { nome, tel, email: document.getElementById('esp-email')?.value || '', nasc: document.getElementById('esp-nasc')?.value || '', end: document.getElementById('esp-end')?.value || '', plano: document.getElementById('esp-plano')?.value || '', carteirinha: document.getElementById('esp-carteirinha')?.value || '', obs: document.getElementById('esp-obs')?.value || '', dias: [...document.querySelectorAll('.esp-dia:checked')].map(c => c.value), periodos: [...document.querySelectorAll('.esp-periodo:checked')].map(c => c.value), procedimentos: [...document.querySelectorAll('.esp-proc-chk:checked')].map(c => c.value), status: 'Aguardando', dataEntrada: new Date().toLocaleDateString('pt-BR') };
    const sb = getDb();
    if (editingEsperaId !== null) {
      Object.assign(LISTA_ESPERA.find(x => x.id === editingEsperaId), dados);
      if (sb) await sb.from('lista_espera').update(map.esperaToDb(dados)).eq('id', editingEsperaId);
      showToast('Atualizado!', 'success');
    } else {
      if (sb) {
        const { data, error } = await sb.from('lista_espera').insert([map.esperaToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = nextEsperaId++; }
      LISTA_ESPERA.push(dados);
      showToast('Adicionado à lista de espera!', 'success');
    }
    closeModal('modal-espera'); refreshUI({ skipHistorico: true });
  };

  // ── Override salvarEvolucao ───────────────────────────────────────────────
  window.salvarEvolucao = async function () {
    const titulo = document.getElementById('evo-titulo').value.trim();
    const texto = document.getElementById('evo-texto').value.trim();
    const profId = parseInt(document.getElementById('evo-prof').value || '0');
    const data = document.getElementById('evo-data').value;
    if (!texto) { showToast('Digite o texto da evolução', 'error'); return; }
    const editId = document.getElementById('evo-id-edit').value;
    const sb = getDb();
    if (editId) {
      const h = HISTORICO.find(x => x.id === parseInt(editId));
      if (h) { h.titulo = titulo || 'Evolução'; h.conteudo = { texto }; h.profId = profId; h.data = data; }
      if (sb) await sb.from('historico').update(map.histToDb(h)).eq('id', parseInt(editId));
      showToast('Evolução atualizada!', 'success');
    } else {
      const novoHist = { pacId: historicoAtualPacId, tipo: 'evolucao', titulo: titulo || 'Evolução', conteudo: { texto }, profId, data, fonte: 'Manual' };
      if (sb) {
        const { data: d, error } = await sb.from('historico').insert([map.histToDb(novoHist)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        novoHist.id = d.id;
      } else { novoHist.id = nextHistId++; }
      HISTORICO.push(novoHist);
      const p = PACIENTES.find(x => x.id === historicoAtualPacId);
      if (p) {
        const appt = APPOINTMENTS.find(a => a.paciente === p.nome && a.dataISO === data && a.status !== 'cancelado');
        if (appt && appt.status !== 'atendido') { appt.status = 'atendido'; if (sb) sb.from('agendamentos').update({ status: 'atendido' }).eq('id', appt.id); renderDayView(); }
      }
      showToast('Evolução registrada!', 'success');
    }
    closeModal('modal-evolucao');
    refreshUI(); // atualiza histórico, timeline, dashboard e agenda
  };

  // ── Override salvarConfigClinica (com gravação no Supabase) ───────────────
  window.salvarConfigClinica = async function () {
    const nome = document.getElementById('cfg-nome-clinica')?.value.trim();
    if (!nome) { showToast('Informe o nome da clínica', 'error'); return; }
    CLINICA.nome         = nome;
    CLINICA.cnpj         = document.getElementById('cfg-cnpj')?.value.trim()         || CLINICA.cnpj;
    CLINICA.endereco     = document.getElementById('cfg-endereco')?.value.trim()      || CLINICA.endereco;
    CLINICA.telefone     = document.getElementById('cfg-tel')?.value.trim()           || CLINICA.telefone;
    CLINICA.email        = document.getElementById('cfg-email-clinica')?.value.trim() || CLINICA.email;
    CLINICA.codPrestador = document.getElementById('cfg-cod-prestador')?.value.trim() || CLINICA.codPrestador;
    CLINICA.cnes         = document.getElementById('cfg-cnes')?.value.trim()          || CLINICA.cnes;
    // Canal de notificação já está em CLINICA.canalNotif (atualizado por setCanalNotif)
    try { renderSidebarLogo(); } catch(e) {}
    await salvarConfigNoDB();
    showToast('Configurações salvas com sucesso!', 'success');
  };

  // ── Override excluir functions ────────────────────────────────────────────
  window.excluirPaciente = async function (id) {
    if (!confirm('Excluir este paciente? Esta ação não pode ser desfeita.')) return;
    const sb = getDb(); if (sb) await sb.from('pacientes').delete().eq('id', id);
    const i = PACIENTES.findIndex(p => p.id === id); if (i > -1) PACIENTES.splice(i, 1);
    refreshUI({ skipHistorico: true }); showToast('Paciente excluído.', 'error');
  };
  window.excluirProfissional = async function (id) {
    if (!confirm('Excluir este profissional?')) return;
    const sb = getDb(); if (sb) await sb.from('profissionais').delete().eq('id', id);
    const i = PROFISSIONAIS.findIndex(p => p.id === id); if (i > -1) PROFISSIONAIS.splice(i, 1);
    refreshUI({ skipHistorico: true }); showToast('Excluído.', 'error');
  };
  window.excluirPlano = async function (id) {
    if (!confirm('Excluir este plano?')) return;
    const sb = getDb(); if (sb) await sb.from('planos_saude').delete().eq('id', id);
    const i = PLANOS.findIndex(p => p.id === id); if (i > -1) PLANOS.splice(i, 1);
    refreshUI({ skipHistorico: true }); showToast('Excluído.', 'error');
  };
  window.excluirProcedimento = async function (id) {
    if (!confirm('Excluir este procedimento?')) return;
    const sb = getDb(); if (sb) await sb.from('procedimentos').delete().eq('id', id);
    const i = PROCEDIMENTOS.findIndex(p => p.id === id); if (i > -1) PROCEDIMENTOS.splice(i, 1);
    refreshUI({ skipHistorico: true }); showToast('Excluído.', 'error');
  };
  window.excluirGuia = async function (id) {
    if (!confirm('Excluir esta guia?')) return;
    const sb = getDb();
    // Reverte qtdUsada na senha antes de excluir
    const guia = GUIAS.find(g => g.id === id);
    if (guia) {
      const senhaRev = SENHAS_PLANO.find(s =>
        s.planoId === guia.planoId &&
        s.paciente.toLowerCase() === guia.pac.toLowerCase() &&
        s.qtdUsada > 0
      );
      if (senhaRev) {
        senhaRev.qtdUsada = Math.max(0, senhaRev.qtdUsada - 1);
        if (senhaRev.qtdUsada < senhaRev.qtdAutorizada) { senhaRev.status = 'Ativa'; senhaRev.ativa = true; }
        if (sb) sb.from('senhas_plano').update({
          qtd_usada: senhaRev.qtdUsada, status: senhaRev.status, ativa: senhaRev.ativa
        }).eq('id', senhaRev.id);
      }
    }
    if (sb) await sb.from('guias_sadt').delete().eq('id', id);
    const i = GUIAS.findIndex(g => g.id === id); if (i > -1) GUIAS.splice(i, 1);
    refreshUI({ skipHistorico: true }); showToast('Guia excluída.', 'error');
  };
  window.excluirLote = async function (id) {
    if (!confirm('Excluir este lote? As guias voltarão para pendente.')) return;
    const l = LOTES.find(x => x.id === id);
    if (l && l.guiaIds) l.guiaIds.forEach(gid => { const g = GUIAS.find(x => x.id === gid); if (g) { g.loteId = null; g.loteNum = null; g.status = 'Pendente'; const sb = getDb(); if (sb) sb.from('guias_sadt').update({ lote_id: null, lote_num: null, status: 'Pendente' }).eq('id', gid); } });
    const sb = getDb(); if (sb) await sb.from('lotes_tiss').delete().eq('id', id);
    const i = LOTES.findIndex(x => x.id === id); if (i > -1) LOTES.splice(i, 1);
    refreshUI({ skipHistorico: true }); showToast('Lote excluído.', 'error');
  };
  window.excluirSenha = async function (id) {
    if (!confirm('Excluir esta autorização?')) return;
    const sb = getDb(); if (sb) await sb.from('senhas_plano').delete().eq('id', id);
    const i = SENHAS_PLANO.findIndex(s => s.id === id); if (i > -1) SENHAS_PLANO.splice(i, 1);
    refreshUI({ skipHistorico: true }); showToast('Autorização excluída.', 'error');
  };
  window.excluirEspera = async function (id) {
    const e = LISTA_ESPERA.find(x => x.id === id);
    if (e?.status === 'Convertido') { showToast('Paciente já convertido — não pode ser excluído.', 'error'); return; }
    if (!confirm('Remover da lista de espera?')) return;
    const sb = getDb(); if (sb) await sb.from('lista_espera').delete().eq('id', id);
    const i = LISTA_ESPERA.findIndex(x => x.id === id); if (i > -1) LISTA_ESPERA.splice(i, 1);
    refreshUI({ skipHistorico: true }); showToast('Removido da lista.', 'error');
  };
  window.excluirHistorico = async function (id) {
    if (!confirm('Excluir este registro?')) return;
    const sb = getDb(); if (sb) await sb.from('historico').delete().eq('id', id);
    const i = HISTORICO.findIndex(h => h.id === id); if (i > -1) HISTORICO.splice(i, 1);
    refreshUI(); // inclui re-abertura do histórico do paciente atual
    showToast('Registro excluído.', 'error');
  };
  window.excluirAgendamento = async function (id) {
    const appt = APPOINTMENTS.find(a => a.id === id);
    if (!appt) return;

    let idsParaExcluir = [id];

    if (appt.isGrupo && appt.groupId) {
      const membros = APPOINTMENTS.filter(a => a.groupId === appt.groupId && a.dataISO === appt.dataISO);
      if (membros.length > 1) {
        const resp = confirm(
          'Este agendamento faz parte de um grupo com ' + membros.length + ' pacientes.\n\n' +
          'Clique OK para excluir TODOS os ' + membros.length + ' agendamentos do grupo.\n' +
          'Clique Cancelar para cancelar a operação.'
        );
        if (!resp) return;
        idsParaExcluir = membros.map(a => a.id);
      } else {
        if (!confirm('Excluir este agendamento permanentemente?')) return;
      }
    } else {
      if (!confirm('Excluir este agendamento permanentemente?')) return;
    }

    const sb = getDb();
    if (sb) {
      for (const eid of idsParaExcluir) {
        await sb.from('notificacoes').delete().eq('agendamento_id', eid).eq('enviada', false);
      }
      await sb.from('agendamentos').delete().in('id', idsParaExcluir);
    }

    idsParaExcluir.forEach(eid => {
      const i = APPOINTMENTS.findIndex(a => a.id === eid);
      if (i > -1) APPOINTMENTS.splice(i, 1);
    });

    closeModal('modal-agendamento');
    refreshUI();
    showToast(
      idsParaExcluir.length > 1
        ? idsParaExcluir.length + ' agendamentos do grupo excluídos.'
        : 'Agendamento excluído.',
      'error'
    );
  };

  // ── Função testarConexaoSupabase ──────────────────────────────────────────
  window.testarConexaoSupabase = async function () {
    const url = document.getElementById('cfg-supa-url')?.value.trim();
    const key = document.getElementById('cfg-supa-key')?.value.trim();
    if (!url || !key) { showToast('Preencha a URL e a chave anon', 'error'); return; }
    const btn = document.getElementById('btn-testar-supabase');
    const statusEl = document.getElementById('supa-status');
    if (btn) { btn.disabled = true; btn.textContent = 'Conectando...'; }
    if (statusEl) { statusEl.style.display = 'flex'; statusEl.innerHTML = '<span style="color:var(--warning)">⏳ Testando conexão...</span>'; }
    try {
      const testClient = window._cfGetOrCreateClient ? window._cfGetOrCreateClient(url, key) : window.supabase.createClient(url, key);
      const { error } = await testClient.from('pacientes').select('count').limit(1);
      if (error && error.code !== 'PGRST116' && error.code !== '42P01') throw error;
      localStorage.setItem('cf_supa_url', url);
      localStorage.setItem('cf_supa_key', key);
      _sb = testClient;
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--success)">✓ Conectado com sucesso! Credenciais salvas.</span>';
      showToast('✓ Conexão bem-sucedida! Carregando dados...', 'success');
      await loadFromSupabase();
    } catch (e) {
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--danger)">✗ Erro: ' + e.message + '</span>';
      showToast('Erro de conexão: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Testar e conectar'; }
    }
  };

  // ── Preenche campos Supabase ao abrir config ──────────────────────────────
  const _origInitConfigPage = window.initConfigPage;
  window.initConfigPage = function () {
    _origInitConfigPage && _origInitConfigPage();
    const urlEl = document.getElementById('cfg-supa-url');
    const keyEl = document.getElementById('cfg-supa-key');
    if (urlEl) urlEl.value = localStorage.getItem('cf_supa_url') || '';
    if (keyEl) keyEl.value = localStorage.getItem('cf_supa_key') || '';
    // Atualiza indicador de status
    const statusEl = document.getElementById('supa-status');
    const url = localStorage.getItem('cf_supa_url');
    if (statusEl && url) {
      statusEl.style.display = 'flex';
      statusEl.innerHTML = '<span style="color:var(--success)">✓ Credenciais salvas — banco de dados ativo</span>';
    }
  };

  // ── Auto-inicializa o cliente Supabase ao abrir o app ─────────────────────
  window.addEventListener('load', function () {
    const url = localStorage.getItem('cf_supa_url');
    const key = localStorage.getItem('cf_supa_key');
    if (url && key && window.supabase) {
           _sb = window._cfGetOrCreateClient ? window._cfGetOrCreateClient(url, key) : window.supabase.createClient(url, key);
      console.log('[ClinicFlow Supabase] Cliente inicializado automaticamente ✓');
    }
  });

  window.loadFromSupabase = loadFromSupabase;
  window._cf = getDb;
  window._cfGetDb = getDb;         // alias usado por sincronizarDados, excluirAgendamento etc.
  window.getDb = getDb;            // alias directo para módulos WA e Notif
  window.salvarConfigNoDB = salvarConfigNoDB;
  window._cfMap   = map;   // expõe os mapeamentos para sincronizarDados
  console.log('[ClinicFlow Supabase] Integração carregada ✓');


  // ════════════════════════════════════════════════════════════════
  //  ESPAÇO CONECTA — Integração Supabase
  // ════════════════════════════════════════════════════════════════

  // Mappers: JS ↔ DB
  const cMap = {
    salaToDb:  s => ({ nome: s.nome, descricao: s.descricao||null, capacidade: s.capacidade||2, cor: s.cor||'sala1', ativo: s.ativo!==false }),
    dbToSala:  r => ({ id: r.id, nome: r.nome, descricao: r.descricao||'', capacidade: r.capacidade||2, cor: r.cor||'sala1', ativo: r.ativo!==false }),
    locToDb:   l => ({ nome: l.nome, especialidade: l.esp||null, telefone: l.tel||null, email: l.email||null, cpf: l.cpf||null, conselho: l.conselho||null, valor_hora: l.valorHora||0, valor_meio: l.valorMeio||0, valor_dia: l.valorDia||0, sala_pref_id: l.salaPref||null, status: l.status||'ativo', obs: l.obs||null }),
    dbToLoc:   r => ({ id: r.id, nome: r.nome, esp: r.especialidade||'', tel: r.telefone||'', email: r.email||'', cpf: r.cpf||'', conselho: r.conselho||'', valorHora: r.valor_hora||0, valorMeio: r.valor_meio||0, valorDia: r.valor_dia||0, salaPref: r.sala_pref_id||'', status: r.status||'ativo', obs: r.obs||'' }),
    resToDb:   r => ({ sala_id: r.salaId, locatario_id: r.locId, data: r.data, hora_ini: r.horaIni, hora_fim: r.horaFim, dur_min: r.durMin||60, recorrencia: r.recorrencia||'unica', serie_id: r.serieId||null, status: r.status||'confirmado', obs: r.obs||null, valor_cobrado: r.valorCobrado||null }),
    dbToRes:   r => ({ id: r.id, salaId: r.sala_id, locId: r.locatario_id, data: r.data, horaIni: r.hora_ini?.slice(0,5)||'', horaFim: r.hora_fim?.slice(0,5)||'', durMin: r.dur_min||60, recorrencia: r.recorrencia||'unica', serieId: r.serie_id||null, status: r.status||'confirmado', obs: r.obs||'', valorCobrado: r.valor_cobrado||null }),
    fechToDb:  f => ({ competencia: f.competencia, locatario_id: f.locatarioId, total_reservas: f.totalReservas||0, total_horas: f.totalHoras||0, total_valor: f.totalValor||0, status: f.status||'emitido', emitido_em: f.emitidoEm||new Date().toISOString(), detalhes: f.detalhes||null }),
    dbToFech:  r => ({ id: r.id, competencia: r.competencia, locatarioId: r.locatario_id, totalReservas: r.total_reservas||0, totalHoras: r.total_horas||0, totalValor: r.total_valor||0, status: r.status||'emitido', emitidoEm: r.emitido_em||'', detalhes: typeof r.detalhes === 'string' ? JSON.parse(r.detalhes||'[]') : (r.detalhes||[]) }),
  };

  // ── Carregar dados do Conecta do Supabase ─────────────────────
  async function loadConecta(sb) {
    // Helper: retorna null se a tabela não existir (404/PGRST) em vez de lançar erro
    async function safeQuery(query, label) {
      try {
        const res = await query;
        if (res.error) {
          const code = res.error?.code || '';
          const msg  = res.error?.message || '';
          // Tabela não existe no Supabase → ignora silenciosamente
          if (code === 'PGRST116' || code === '42P01' || msg.includes('does not exist') || res.status === 404) {
            console.info('[ClinicFlow Conecta] Tabela "' + label + '" não encontrada — módulo desativado.');
            return null;
          }
          console.warn('[ClinicFlow Conecta] Erro ao carregar ' + label + ':', res.error.message);
          return null;
        }
        return res;
      } catch(e) {
        console.warn('[ClinicFlow Conecta] Exceção ao carregar ' + label + ':', e.message);
        return null;
      }
    }

    try {
      const [salas, locs, reservas, fechamentos] = await Promise.all([
        safeQuery(sb.from('salas_conecta').select('*').eq('ativo', true).order('nome'), 'salas_conecta'),
        safeQuery(sb.from('locatarios').select('*').order('nome'), 'locatarios'),
        safeQuery(sb.from('reservas_salas').select('*').order('data').limit(5000), 'reservas_salas'),
        safeQuery(sb.from('fechamentos_locacao').select('*').order('competencia', {ascending:false}).limit(500), 'fechamentos_locacao'),
      ]);
      // Sempre limpa e recarrega do banco — não mantém dados demo se Supabase respondeu
      if (salas !== null) {
        SALAS_CONECTA.length = 0;
        (salas?.data || []).forEach(r => SALAS_CONECTA.push(cMap.dbToSala(r)));
      }
      if (locs !== null) {
        LOCATARIOS.length = 0;
        (locs?.data || []).forEach(r => LOCATARIOS.push(cMap.dbToLoc(r)));
      }
      if (reservas !== null) {
        RESERVAS_SALAS.length = 0;
        (reservas?.data || []).forEach(r => RESERVAS_SALAS.push(cMap.dbToRes(r)));
      }
      if (fechamentos !== null) {
        FECHAMENTOS_CONECTA.length = 0;
        (fechamentos?.data || []).forEach(r => FECHAMENTOS_CONECTA.push(cMap.dbToFech(r)));
      }
      // Persiste cópia local
      if (typeof _conectaSalvarLocal === 'function') _conectaSalvarLocal();
      // Atualiza selects de salas e re-renderiza
      try {
        const sel = document.getElementById('cs-sala-filtro');
        if (sel) {
          sel.innerHTML = '<option value="">Todas as salas</option>' +
            SALAS_CONECTA.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
        }
        if (typeof conectaRenderAgenda      === 'function') conectaRenderAgenda();
        if (typeof conectaRenderLocatarios  === 'function') conectaRenderLocatarios();
        if (typeof renderHistoricoFechamentos === 'function') renderHistoricoFechamentos();
      } catch(_e) {}
      console.log(`[Conecta] ${SALAS_CONECTA.length} salas, ${LOCATARIOS.length} locatários, ${RESERVAS_SALAS.length} reservas, ${FECHAMENTOS_CONECTA.length} fechamentos carregados ✓`);
    } catch(e) {
      console.error('[Conecta] Erro ao carregar:', e.message);
      // Fallback: tenta carregar do localStorage
      if (typeof _conectaCarregarLocal === 'function') _conectaCarregarLocal();
    }
  }

  // Garante que o loadConecta é chamado após o loadFromSupabase principal
  const _origLoad = window.loadFromSupabase;
  window.loadFromSupabase = async function () {
    await _origLoad();
    const sb = getDb();
    if (sb) await loadConecta(sb);
  };

  // ── Override salvarSala ───────────────────────────────────────
  window._salvarSalaSupabase = window.salvarSala = async function () {
    const nome = document.getElementById('sala-nome')?.value?.trim();
    if (!nome) { showToast('Nome da sala é obrigatório', 'error'); return; }
    const cap    = parseInt(document.getElementById('sala-cap')?.value) || 2;
    const desc   = document.getElementById('sala-desc')?.value || '';
    const cor    = document.querySelector('input[name="sala-cor"]:checked')?.value || 'sala1';
    const editId = document.getElementById('sala-edit-id')?.value;
    const dados  = { nome, descricao: desc, capacidade: cap, cor, ativo: true };
    const sb = getDb();

    if (editId) {
      const numId = isNaN(editId) ? editId : Number(editId);
      if (sb) {
        const { error } = await sb.from('salas_conecta').update(cMap.salaToDb(dados)).eq('id', numId);
        if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); return; }
      }
      const idx = SALAS_CONECTA.findIndex(s => String(s.id) === String(editId));
      if (idx >= 0) SALAS_CONECTA[idx] = { ...SALAS_CONECTA[idx], ...dados };
    } else {
      if (sb) {
        const { data, error } = await sb.from('salas_conecta').insert([cMap.salaToDb(dados)]).select().single();
        if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = 's' + Date.now(); }
      SALAS_CONECTA.push(dados);
    }

    const sel = document.getElementById('cs-sala-filtro');
    if (sel) {
      sel.innerHTML = '<option value="">Todas as salas</option>' +
        SALAS_CONECTA.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
    }
    if (typeof _conectaSalvarLocal === 'function') _conectaSalvarLocal();
    if (typeof renderSalasModal    === 'function') renderSalasModal();
    if (typeof limparFormSala      === 'function') limparFormSala();
    if (typeof conectaRenderAgenda === 'function') conectaRenderAgenda();
    showToast('Sala salva!', 'success');
  };

  // ── Override excluirSala ──────────────────────────────────────
  window._excluirSalaSupabase = window.excluirSala = async function (salaId) {
    const sala = SALAS_CONECTA.find(s => String(s.id) === String(salaId));
    if (!sala) return;
    const temReservas = RESERVAS_SALAS.some(r => String(r.salaId) === String(salaId) && r.status !== 'cancelado');
    if (temReservas) { showToast('Não é possível excluir sala com reservas ativas', 'error'); return; }
    if (!confirm(`Excluir a sala "${sala.nome}"?`)) return;
    const sb = getDb();
    if (sb) {
      // Soft-delete: marca como inativo
      const { error } = await sb.from('salas_conecta').update({ ativo: false }).eq('id', salaId);
      if (error) { showToast('Erro: ' + error.message, 'error'); return; }
    }
    SALAS_CONECTA = SALAS_CONECTA.filter(s => String(s.id) !== String(salaId));
    if (typeof _conectaSalvarLocal === 'function') _conectaSalvarLocal();
    if (typeof renderSalasModal    === 'function') renderSalasModal();
    if (typeof conectaRenderAgenda === 'function') conectaRenderAgenda();
    showToast('Sala removida', 'success');
  };

  // ── Override salvarLocatario ──────────────────────────────────
  window._salvarLocatarioSupabase = window.salvarLocatario = async function () {
    const nome = document.getElementById('loc-nome')?.value?.trim();
    if (!nome) { showToast('Nome é obrigatório', 'error'); return; }
    const editId = document.getElementById('loc-edit-id')?.value;
    const dados = {
      nome,
      esp:       document.getElementById('loc-esp')?.value || '',
      tel:       document.getElementById('loc-tel')?.value || '',
      email:     document.getElementById('loc-email')?.value || '',
      cpf:       document.getElementById('loc-cpf')?.value || '',
      conselho:  document.getElementById('loc-conselho')?.value || '',
      obs:       document.getElementById('loc-obs')?.value || '',
      valorHora: parseFloat(document.getElementById('loc-valor-hora')?.value) || 0,
      valorMeio: parseFloat(document.getElementById('loc-valor-meio')?.value) || 0,
      valorDia:  parseFloat(document.getElementById('loc-valor-dia')?.value) || 0,
      salaPref:  document.getElementById('loc-sala-pref')?.value || null,
      status:    document.getElementById('loc-status')?.value || 'ativo',
    };
    const sb = getDb();
    if (editId) {
      const numId = isNaN(editId) ? editId : Number(editId);
      if (sb) {
        const { error } = await sb.from('locatarios').update(cMap.locToDb(dados)).eq('id', numId);
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
      }
      const idx = LOCATARIOS.findIndex(l => String(l.id) === String(editId));
      if (idx >= 0) LOCATARIOS[idx] = { ...LOCATARIOS[idx], ...dados };
      showToast('Locatário atualizado!', 'success');
    } else {
      if (sb) {
        const { data, error } = await sb.from('locatarios').insert([cMap.locToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = 'l' + Date.now(); }
      LOCATARIOS.push(dados);
      showToast('Locatário cadastrado!', 'success');
    }
    if (typeof _conectaSalvarLocal === 'function') _conectaSalvarLocal();
    closeModal('modal-novo-locatario');
    if (typeof conectaRenderLocatarios === 'function') conectaRenderLocatarios();
  };

  // ── Override excluirLocatario ─────────────────────────────────
  window.excluirLocatario = async function (locId) {
    const loc = LOCATARIOS.find(l => String(l.id) === String(locId));
    if (!loc) return;
    const temReservas = RESERVAS_SALAS.some(r => String(r.locId) === String(locId) && r.status !== 'cancelado');
    if (temReservas) { showToast('Não é possível excluir locatário com reservas ativas', 'error'); return; }
    if (!confirm(`Excluir o locatário "${loc.nome}"? Esta ação não pode ser desfeita.`)) return;
    const sb = getDb();
    if (sb) {
      const { error } = await sb.from('locatarios').delete().eq('id', isNaN(locId) ? locId : Number(locId));
      if (error) { showToast('Erro ao excluir: ' + error.message, 'error'); return; }
    }
    const idx = LOCATARIOS.findIndex(l => String(l.id) === String(locId));
    if (idx >= 0) LOCATARIOS.splice(idx, 1);
    if (typeof _conectaSalvarLocal === 'function') _conectaSalvarLocal();
    if (typeof conectaRenderLocatarios === 'function') conectaRenderLocatarios();
    showToast('Locatário removido', 'success');
  };

  // ── Override salvarReserva ────────────────────────────────────
  window._salvarReservaSupabase = window.salvarReserva = async function () {
    const salaId  = document.getElementById('res-sala')?.value;
    const locId   = document.getElementById('res-prof')?.value;
    const data    = document.getElementById('res-data')?.value;
    const horaIni = document.getElementById('res-hora-ini')?.value;
    const horaFim = document.getElementById('res-hora-fim')?.value;
    const dur     = parseInt(document.getElementById('res-duracao')?.value || '60');
    const recorr  = document.getElementById('res-recorrencia')?.value || 'unica';
    const recorrAte = document.getElementById('res-recorr-ate')?.value || '';
    const obs     = document.getElementById('res-obs')?.value || '';

    if (!salaId || !locId || !data || !horaIni) {
      showToast('Preencha todos os campos obrigatórios', 'error'); return;
    }

    const loc = LOCATARIOS.find(l => String(l.id) === String(locId));
    const valorCobrado = typeof conectaCalcValor === 'function' ? conectaCalcValor(loc, dur) : 0;

    // Gerar datas recorrentes
    const datas = [data];
    const serieId = (recorr !== 'unica' && recorrAte && recorrAte > data)
      ? crypto.randomUUID()
      : null;

    if (serieId) {
      const intervalo = recorr === 'semanal' ? 7 : 14;
      let d = new Date(data + 'T12:00:00');
      const ate = new Date(recorrAte + 'T12:00:00');
      while (true) {
        d.setDate(d.getDate() + intervalo);
        if (d > ate) break;
        datas.push(d.toISOString().slice(0, 10));
      }
    }

    const sb = getDb();
    let adicionadas = 0, conflitos = 0;

    for (const dt of datas) {
      // Verificar conflito em memória
      const conflito = RESERVAS_SALAS.some(r =>
        String(r.salaId) === String(salaId) && r.data === dt &&
        r.status !== 'cancelado' &&
        !(horaFim <= r.horaIni || horaIni >= r.horaFim)
      );
      if (conflito) { conflitos++; continue; }

      const novaRes = {
        salaId, locId, data: dt, horaIni, horaFim, durMin: dur,
        recorrencia: recorr, serieId, status: 'confirmado', obs, valorCobrado
      };

      if (sb) {
        const { data: dbRow, error } = await sb.from('reservas_salas')
          .insert([cMap.resToDb(novaRes)]).select().single();
        if (error) { conflitos++; console.error('[Reserva INSERT]', error.message); continue; }
        novaRes.id = dbRow.id;
      } else {
        novaRes.id = 'r' + Date.now() + '_' + adicionadas;
      }
      RESERVAS_SALAS.push(novaRes);
      adicionadas++;
    }

    if (typeof _conectaSalvarLocal === 'function') _conectaSalvarLocal();
    closeModal('modal-nova-reserva');
    if (typeof conectaRenderAgenda === 'function') conectaRenderAgenda();

    if (adicionadas > 0 && conflitos === 0) {
      showToast(`${adicionadas} reserva${adicionadas > 1 ? 's' : ''} confirmada${adicionadas > 1 ? 's' : ''}!`, 'success');
    } else if (adicionadas > 0) {
      showToast(`${adicionadas} confirmada${adicionadas>1?'s':''}. ${conflitos} conflito${conflitos>1?'s':''} ignorado${conflitos>1?'s':''}.`, 'success');
    } else {
      showToast('Conflito de horário — nenhuma reserva criada', 'error');
    }
  };

  // ── Override cancelarReserva ──────────────────────────────────
  window._cancelarReservaSupabase = window.cancelarReserva = async function (escopo) {
    const res = RESERVAS_SALAS.find(r => String(r.id) === String(RESERVA_ATUAL_ID));
    if (!res) { closeModal('modal-cancelar-lote'); return; }
    const sb = getDb();

    const marcarCancelado = async (r) => {
      r.status = 'cancelado';
      if (sb) await sb.from('reservas_salas').update({ status: 'cancelado' }).eq('id', r.id);
    };

    if (escopo === 'unica') {
      await marcarCancelado(res);
      showToast('Reserva cancelada', 'success');
    } else if (escopo === 'futuras') {
      const alvo = RESERVAS_SALAS.filter(r =>
        r.serieId && r.serieId === res.serieId && r.data >= res.data && r.status !== 'cancelado'
      );
      for (const r of alvo) await marcarCancelado(r);
      showToast(`${alvo.length} reserva(s) da série canceladas`, 'success');
    } else {
      const alvo = RESERVAS_SALAS.filter(r => r.serieId && r.serieId === res.serieId);
      for (const r of alvo) await marcarCancelado(r);
      showToast('Toda a série cancelada', 'success');
    }

    if (typeof _conectaSalvarLocal === 'function') _conectaSalvarLocal();
    closeModal('modal-cancelar-lote');
    if (typeof conectaRenderAgenda === 'function') conectaRenderAgenda();
  };

  window.cancelarReservaAtual = function () {
    if (!RESERVA_ATUAL_ID) return;
    const res = RESERVAS_SALAS.find(r => String(r.id) === String(RESERVA_ATUAL_ID));
    if (!res) return;
    if (res.serieId) {
      closeModal('modal-reserva-detalhe');
      openModal('modal-cancelar-lote');
    } else {
      if (!confirm('Deseja cancelar esta reserva?')) return;
      window.cancelarReserva('unica');
      closeModal('modal-reserva-detalhe');
    }
  };

  // ── Override calcularFechamentoLocacao + salvar no DB ─────────
  const _origCalcFech = window.calcularFechamentoLocacao;
  window.calcularFechamentoLocacao = function () {
    if (typeof _origCalcFech === 'function') _origCalcFech();
  };

  window.confirmarFechamento = async function (competencia) {
    const sb = getDb();
    const [ano, mes] = competencia.split('-').map(Number);
    const ISO_PRIM = `${ano}-${String(mes).padStart(2,'0')}-01`;
    const ISO_ULT  = new Date(ano, mes, 0).toISOString().slice(0,10);
    const reservasMes = RESERVAS_SALAS.filter(r =>
      r.status !== 'cancelado' && r.data >= ISO_PRIM && r.data <= ISO_ULT
    );
    const locComRes = LOCATARIOS.filter(l => reservasMes.some(r => String(r.locId) === String(l.id)));
    if (!locComRes.length) { showToast('Nenhum locatário com reservas neste período', 'error'); return; }

    let salvos = 0;
    for (const loc of locComRes) {
      const resLoc     = reservasMes.filter(r => String(r.locId) === String(loc.id));
      const totalHoras = resLoc.reduce((a, r) => a + r.durMin / 60, 0);
      const totalValor = resLoc.reduce((a, r) => a + (typeof conectaCalcValor === 'function' ? conectaCalcValor(loc, r.durMin) : 0), 0);
      const detalhes   = resLoc.map(r => ({
        id: r.id, data: r.data, horaIni: r.horaIni, horaFim: r.horaFim,
        durMin: r.durMin, salaId: r.salaId, obs: r.obs
      }));
      const fechObj = {
        competencia, locatarioId: loc.id,
        totalReservas: resLoc.length, totalHoras, totalValor,
        status: 'emitido', emitidoEm: new Date().toISOString(), detalhes
      };

      // Atualiza array em memória (upsert local)
      const existIdx = FECHAMENTOS_CONECTA.findIndex(f =>
        f.competencia === competencia && String(f.locatarioId) === String(loc.id)
      );
      if (existIdx >= 0) {
        FECHAMENTOS_CONECTA[existIdx] = { ...FECHAMENTOS_CONECTA[existIdx], ...fechObj };
      } else {
        FECHAMENTOS_CONECTA.push({ id: 'fech_' + Date.now() + '_' + salvos, ...fechObj });
      }

      // Persiste no Supabase se disponível
      if (sb) {
        const payload = cMap.fechToDb(fechObj);
        const { error } = await sb.from('fechamentos_locacao')
          .upsert(payload, { onConflict: 'competencia,locatario_id' });
        if (error) console.error('[Fechamento UPSERT]', error.message);
      }
      salvos++;
    }

    // Persiste localmente sempre
    if (typeof _conectaSalvarLocal === 'function') _conectaSalvarLocal();

    // Atualiza historico se visível
    if (typeof renderHistoricoFechamentos === 'function') renderHistoricoFechamentos();

    const destino = sb ? 'banco de dados e localmente' : 'localmente (Supabase não conectado)';
    showToast(`Fechamento de ${salvos} locatário(s) registrado ${destino}!`, 'success');
  };

  window._loadConectaSupabase = loadConecta;
  console.log('[ClinicFlow Supabase] Módulo Espaço Conecta integrado ✓');
})();
