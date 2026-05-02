//  ESPAÇO CONECTA — Módulo de Locação de Salas
//  (variáveis globais declaradas no script principal)
// ═══════════════════════════════════════════════════════════════════

// Cores das salas
const SALA_CORES = ['sala1','sala2','sala3','sala4'];

function conectaInitSalas() {
  // Verifica se Supabase está configurado — se sim, não injeta dados demo,
  // pois o loadConecta irá carregar os dados reais do banco.
  const _sbUrl = localStorage.getItem('cf_supa_url') || '';
  const _sbKey = localStorage.getItem('cf_supa_key') || '';
  const _temSupabase = !!(_sbUrl && _sbKey);

  // Salas padrão (Espaço Conecta) — apenas se não há Supabase configurado
  if (SALAS_CONECTA.length === 0 && !_temSupabase) {
    SALAS_CONECTA = [
      { id: 's1', nome: 'Sala 1', descricao: 'Sala individual — ar-condicionado, divã', capacidade: 2, cor: 'sala1' },
      { id: 's2', nome: 'Sala 2', descricao: 'Sala individual — mesa redonda, 4 cadeiras', capacidade: 4, cor: 'sala2' },
      { id: 's3', nome: 'Sala 3', descricao: 'Sala em grupo — até 10 pessoas', capacidade: 10, cor: 'sala3' },
    ];
  }

  // Locatários demo — apenas se não há Supabase configurado
  if (LOCATARIOS.length === 0 && !_temSupabase) {
    LOCATARIOS = [
      { id: 'l1', nome: 'Dra. Ana Martins', esp: 'Psicologia', tel: '(11) 98765-0001', email: 'ana@clinica.com', cpf: '111.222.333-44', conselho: 'CRP 06/111222', valorHora: 50, valorMeio: 180, valorDia: 320, salaPref: 's1', status: 'ativo', obs: '' },
      { id: 'l2', nome: 'Dr. Carlos Ramos', esp: 'Psiquiatria', tel: '(11) 98765-0002', email: 'carlos@clinica.com', cpf: '222.333.444-55', conselho: 'CRM 12345/SP', valorHora: 80, valorMeio: 280, valorDia: 500, salaPref: 's2', status: 'ativo', obs: '' },
      { id: 'l3', nome: 'Dra. Sofia Lima', esp: 'Neuropsicologia', tel: '(11) 98765-0003', email: 'sofia@clinica.com', cpf: '333.444.555-66', conselho: 'CRP 06/222333', valorHora: 65, valorMeio: 220, valorDia: 380, salaPref: '', status: 'ativo', obs: 'Atende grupos às quintas' },
    ];
  }

  // Reservas demo (semana atual) — apenas se não há Supabase configurado
  if (RESERVAS_SALAS.length === 0 && !_temSupabase) {
    const hoje = new Date();
    const seg = new Date(hoje);
    seg.setDate(hoje.getDate() - hoje.getDay() + 1);
    const fmt = d => d.toISOString().slice(0,10);

    const d0 = new Date(seg); d0.setDate(seg.getDate() + 0);
    const d1 = new Date(seg); d1.setDate(seg.getDate() + 1);
    const d2 = new Date(seg); d2.setDate(seg.getDate() + 2);
    const d3 = new Date(seg); d3.setDate(seg.getDate() + 3);

    RESERVAS_SALAS = [
      { id: 'r1', salaId: 's1', locId: 'l1', data: fmt(d0), horaIni: '08:00', horaFim: '10:00', durMin: 120, status: 'confirmado', obs: '', recorrencia: 'unica' },
      { id: 'r2', salaId: 's1', locId: 'l2', data: fmt(d0), horaIni: '14:00', horaFim: '16:00', durMin: 120, status: 'confirmado', obs: '', recorrencia: 'unica' },
      { id: 'r3', salaId: 's2', locId: 'l3', data: fmt(d1), horaIni: '09:00', horaFim: '12:00', durMin: 180, status: 'confirmado', obs: 'Grupo terapêutico', recorrencia: 'semanal' },
      { id: 'r4', salaId: 's1', locId: 'l1', data: fmt(d2), horaIni: '08:00', horaFim: '10:00', durMin: 120, status: 'confirmado', obs: '', recorrencia: 'semanal' },
      { id: 'r5', salaId: 's3', locId: 'l2', data: fmt(d3), horaIni: '13:00', horaFim: '17:00', durMin: 240, status: 'confirmado', obs: 'Capacitação', recorrencia: 'unica' },
    ];
  }

  // Popular select de salas
  const sel = document.getElementById('cs-sala-filtro');
  if (sel) {
    sel.innerHTML = '<option value="">Todas as salas</option>';
    SALAS_CONECTA.forEach(s => {
      sel.innerHTML += `<option value="${s.id}">${s.nome}</option>`;
    });
  }

  conectaRenderAgenda();
  conectaRenderLocatarios();
}

// ── Cálculo da semana de referência ─────────────────────────────
function conectaGetWeekDates() {
  const today = new Date();
  today.setDate(today.getDate() + CS_WEEK_OFFSET * 7);
  const day = today.getDay(); // 0=dom
  const mon = new Date(today);
  mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    days.push(d);
  }
  return days;
}

function conectaChangeWeek(dir) { CS_WEEK_OFFSET += dir; conectaRenderAgenda(); }
function conectaGotoToday() { CS_WEEK_OFFSET = 0; conectaRenderAgenda(); }

// ── Renderiza grade semanal de salas ─────────────────────────────
function conectaRenderAgenda() {
  const days = conectaGetWeekDates();
  const filtroSala = document.getElementById('cs-sala-filtro')?.value || '';
  const salasFiltradas = filtroSala ? SALAS_CONECTA.filter(s => s.id === filtroSala) : SALAS_CONECTA;

  // Label da semana
  const lblEl = document.getElementById('cs-week-label');
  if (lblEl) {
    const ini = days[0].toLocaleDateString('pt-BR', {day:'2-digit',month:'short'});
    const fim = days[6].toLocaleDateString('pt-BR', {day:'2-digit',month:'short',year:'numeric'});
    lblEl.textContent = `${ini} — ${fim}`;
  }

  const container = document.getElementById('cs-agenda-container');
  if (!container) return;
  container.innerHTML = '';

  const HORAS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

  salasFiltradas.forEach(sala => {
    const wrap = document.createElement('div');
    wrap.className = 'sala-card';

    // Header da sala
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border);background:var(--bg-raised)';
    header.innerHTML = `
      <span class="sala-pill ${sala.cor}">🚪 ${sala.nome}</span>
      <span style="font-size:12px;color:var(--text-muted)">${sala.descricao}</span>
      <span style="margin-left:auto;font-size:12px;color:var(--text-muted)">👥 Cap. ${sala.capacidade} pessoas</span>
      <button class="btn-sm btn-accent" style="padding:4px 10px;font-size:12px" onclick="abrirModalNovaReserva('${sala.id}')">+ Reservar</button>
    `;
    wrap.appendChild(header);

    // Grade semanal
    const gridWrap = document.createElement('div');
    gridWrap.style.cssText = 'overflow-x:auto;padding:0';

    const grid = document.createElement('div');
    grid.className = 'conecta-cal-grid';
    grid.style.minWidth = '700px';

    // Header: coluna de hora + 7 dias
    const todayISO = new Date().toISOString().slice(0,10);
    grid.innerHTML = `<div class="ch">Hora</div>` +
      days.map(d => {
        const iso = d.toISOString().slice(0,10);
        const isHoje = iso === todayISO;
        const label = d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'});
        return `<div class="ch ${isHoje?'hoje':''}">${label}</div>`;
      }).join('');

    // Linhas de hora
    HORAS.forEach(hora => {
      grid.innerHTML += `<div class="time-lbl">${hora}</div>`;
      days.forEach(d => {
        const iso = d.toISOString().slice(0,10);
        // Reservas nesta sala/hora/dia
        const reservas = RESERVAS_SALAS.filter(r =>
          r.salaId === sala.id &&
          r.data === iso &&
          r.status !== 'cancelado' &&
          r.horaIni <= hora && r.horaFim > hora
        );
        const isCurrUser = false; // em produção verificaria o usuário logado
        let cellClass = 'day-cell';
        let cellContent = '';

        if (reservas.length > 0) {
          const res = reservas[0];
          const loc = LOCATARIOS.find(l => l.id === res.locId);
          cellClass += ' ocupado';
          cellContent = `<div class="day-cell-tag azul" title="${loc?.nome||''} — ${res.horaIni}-${res.horaFim}" style="cursor:pointer" onclick="verReserva('${res.id}')">${loc?.nome?.split(' ')[0]||'—'}</div>`;
        }

        grid.innerHTML += `<div class="${cellClass}" onclick="cellClique('${sala.id}','${iso}','${hora}')" style="${reservas.length?'cursor:default':''}">${cellContent}</div>`;
      });
    });

    gridWrap.appendChild(grid);
    wrap.appendChild(gridWrap);
    container.appendChild(wrap);
  });
}

function cellClique(salaId, dataISO, hora) {
  // Se a célula está livre, abre modal de nova reserva pré-preenchida
  const reservada = RESERVAS_SALAS.some(r =>
    r.salaId === salaId && r.data === dataISO && r.status !== 'cancelado' &&
    r.horaIni <= hora && r.horaFim > hora
  );
  if (reservada) return;
  abrirModalNovaReserva(salaId, dataISO, hora);
}

function verReserva(resId) {
  const res = RESERVAS_SALAS.find(r => r.id === resId);
  if (!res) return;
  RESERVA_ATUAL_ID = resId;
  const sala = SALAS_CONECTA.find(s => s.id === res.salaId);
  const loc  = LOCATARIOS.find(l => l.id === res.locId);
  const dur  = res.durMin;
  const horas = Math.floor(dur/60);
  const mins  = dur % 60;
  const durStr = horas > 0 ? (mins > 0 ? `${horas}h${mins}min` : `${horas}h`) : `${mins}min`;
  const valorCalc = conectaCalcValor(loc, dur);
  const dataFmt = new Date(res.data + 'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});

  document.getElementById('reserva-detalhe-body').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--bg-raised);border-radius:var(--radius-md)">
        <div class="loc-avatar">${loc?.nome?.charAt(0)||'?'}</div>
        <div>
          <div style="font-size:15px;font-weight:600">${loc?.nome||'Locatário'}</div>
          <div style="font-size:12px;color:var(--text-muted)">${loc?.esp||''}</div>
        </div>
        <span class="sala-pill ${sala?.cor||'sala1'}" style="margin-left:auto">${sala?.nome||'Sala'}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="background:var(--bg-raised);border-radius:var(--radius-sm);padding:10px 14px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:0.3px">Data</div>
          <div style="font-size:14px;font-weight:500">${dataFmt}</div>
        </div>
        <div style="background:var(--bg-raised);border-radius:var(--radius-sm);padding:10px 14px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:0.3px">Horário</div>
          <div style="font-size:14px;font-weight:500">${res.horaIni} – ${res.horaFim} (${durStr})</div>
        </div>
        <div style="background:var(--bg-raised);border-radius:var(--radius-sm);padding:10px 14px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:0.3px">Recorrência</div>
          <div style="font-size:14px;font-weight:500">${{unica:'Única',semanal:'Semanal',quinzenal:'Quinzenal'}[res.recorrencia]||'Única'}</div>
        </div>
        <div style="background:var(--bg-raised);border-radius:var(--radius-sm);padding:10px 14px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:0.3px">Valor estimado</div>
          <div style="font-size:18px;font-weight:700;color:var(--success)">${brlFmt(valorCalc)}</div>
        </div>
      </div>
      ${res.obs ? `<div style="background:var(--bg-raised);border-radius:var(--radius-sm);padding:10px 14px"><div style="font-size:11px;color:var(--text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:0.3px">Observações</div><div style="font-size:13px">${res.obs}</div></div>` : ''}
    </div>
  `;

  // Esconde o botão de cancelar se não for admin/recepcao
  const btnCancel = document.getElementById('btn-cancelar-reserva');
  if (btnCancel) {
    const role = (typeof currentUser !== 'undefined' && currentUser?.role) || '';
    btnCancel.style.display = (role === 'admin' || role === 'recepcao') ? '' : 'none';
  }

  openModal('modal-reserva-detalhe');
}

function cancelarReservaAtual() {
  if (!RESERVA_ATUAL_ID) return;
  const res = RESERVAS_SALAS.find(r => r.id === RESERVA_ATUAL_ID);
  if (!res) return;
  // Se recorrente, oferecer opção de cancelar série
  if (res.recorrencia && res.recorrencia !== 'unica') {
    closeModal('modal-reserva-detalhe');
    openModal('modal-cancelar-lote');
  } else {
    if (!confirm('Deseja cancelar esta reserva?')) return;
    res.status = 'cancelado';
    closeModal('modal-reserva-detalhe');
    conectaRenderAgenda();
    showToast('Reserva cancelada', 'success');
  }
}

async function cancelarReserva(escopo) {
  if (window._cancelarReservaSupabase) { return window._cancelarReservaSupabase(escopo); }
  const res = RESERVAS_SALAS.find(r => r.id === RESERVA_ATUAL_ID);
  if (!res) { closeModal('modal-cancelar-lote'); return; }
  if (escopo === 'unica') {
    res.status = 'cancelado';
    showToast('Reserva cancelada', 'success');
  } else if (escopo === 'futuras') {
    RESERVAS_SALAS.forEach(r => {
      if (r.salaId === res.salaId && r.locId === res.locId &&
          r.horaIni === res.horaIni && r.recorrencia === res.recorrencia &&
          r.data >= res.data && r.status !== 'cancelado') r.status = 'cancelado';
    });
    showToast('Esta e as próximas reservas da série foram canceladas', 'success');
  } else if (escopo === 'todas') {
    RESERVAS_SALAS.forEach(r => {
      if (r.salaId === res.salaId && r.locId === res.locId &&
          r.horaIni === res.horaIni && r.recorrencia === res.recorrencia) r.status = 'cancelado';
    });
    showToast('Todas as reservas da série foram canceladas', 'success');
  }
  closeModal('modal-cancelar-lote');
  conectaRenderAgenda();
}

// ── Gestão de Salas ──────────────────────────────────────────────
function abrirGestaoSalas() {
  renderSalasModal();
  limparFormSala();
  openModal('modal-gestao-salas');
}

function renderSalasModal() {
  const el = document.getElementById('salas-list-modal');
  if (!el) return;
  if (SALAS_CONECTA.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px">Nenhuma sala cadastrada.</div>`;
    return;
  }
  el.innerHTML = `
    <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px">Salas cadastradas</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${SALAS_CONECTA.map(s => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-raised);border-radius:var(--radius-sm);border:1px solid var(--border)">
          <span class="sala-pill ${s.cor}" style="font-size:12px">🚪 ${s.nome}</span>
          <span style="font-size:12px;color:var(--text-muted);flex:1">${s.descricao || '—'} · Cap. ${s.capacidade}</span>
          <div style="display:flex;gap:4px">
            <button class="btn-sm btn-secondary" style="padding:3px 8px;font-size:11px" onclick="editarSala('${s.id}')">Editar</button>
            <button class="btn-sm btn-secondary" style="padding:3px 8px;font-size:11px;color:var(--danger)" onclick="excluirSala('${s.id}')">Excluir</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function editarSala(salaId) {
  const s = SALAS_CONECTA.find(x => x.id === salaId);
  if (!s) return;
  document.getElementById('sala-edit-id').value = s.id;
  document.getElementById('sala-nome').value = s.nome;
  document.getElementById('sala-cap').value = s.capacidade;
  document.getElementById('sala-desc').value = s.descricao || '';
  document.getElementById('sala-form-title').textContent = '✏️ Editando: ' + s.nome;
  const radio = document.getElementById('cor-' + s.cor);
  if (radio) radio.checked = true;
  atualizarCorLabels();
}

function limparFormSala() {
  document.getElementById('sala-edit-id').value = '';
  document.getElementById('sala-nome').value = '';
  document.getElementById('sala-cap').value = '2';
  document.getElementById('sala-desc').value = '';
  document.getElementById('sala-form-title').textContent = '➕ Adicionar nova sala';
  const r = document.getElementById('cor-sala1');
  if (r) r.checked = true;
  atualizarCorLabels();
}

function atualizarCorLabels() {
  ['sala1','sala2','sala3','sala4'].forEach(c => {
    const lbl   = document.getElementById('cor-' + c + '-lbl');
    const radio = document.getElementById('cor-' + c);
    if (lbl && radio) {
      lbl.style.borderColor = radio.checked ? 'var(--accent)' : 'transparent';
      lbl.style.background  = radio.checked ? 'var(--accent-soft)' : '';
    }
  });
}

document.addEventListener('change', function(e) {
  if (e.target && e.target.name === 'sala-cor') atualizarCorLabels();
});

async function salvarSala() {
  if (window._salvarSalaSupabase) { return window._salvarSalaSupabase(); }
  const nome = document.getElementById('sala-nome')?.value?.trim();
  if (!nome) { showToast('Nome da sala é obrigatório', 'error'); return; }
  const cap    = parseInt(document.getElementById('sala-cap')?.value) || 2;
  const desc   = document.getElementById('sala-desc')?.value || '';
  const cor    = document.querySelector('input[name="sala-cor"]:checked')?.value || 'sala1';
  const editId = document.getElementById('sala-edit-id')?.value;

  if (editId) {
    const idx = SALAS_CONECTA.findIndex(s => s.id === editId);
    if (idx >= 0) SALAS_CONECTA[idx] = { ...SALAS_CONECTA[idx], nome, capacidade: cap, descricao: desc, cor };
  } else {
    SALAS_CONECTA.push({ id: 's' + Date.now(), nome, capacidade: cap, descricao: desc, cor });
  }
  // Atualizar select filtro agenda
  const selFiltro = document.getElementById('cs-sala-filtro');
  if (selFiltro) {
    selFiltro.innerHTML = '<option value="">Todas as salas</option>' +
      SALAS_CONECTA.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
  }
  renderSalasModal();
  limparFormSala();
  conectaRenderAgenda();
  showToast('Sala salva!', 'success');
}

async function excluirSala(salaId) {
  if (window._excluirSalaSupabase) { return window._excluirSalaSupabase(salaId); }
  const sala = SALAS_CONECTA.find(s => s.id === salaId);
  if (!sala) return;
  const temReservas = RESERVAS_SALAS.some(r => r.salaId === salaId && r.status !== 'cancelado');
  if (temReservas) { showToast('Não é possível excluir sala com reservas ativas', 'error'); return; }
  if (!confirm(`Excluir a sala "${sala.nome}"?`)) return;
  SALAS_CONECTA = SALAS_CONECTA.filter(s => s.id !== salaId);
  renderSalasModal();
  conectaRenderAgenda();
  showToast('Sala excluída', 'success');
}

// ── Modal: Nova Reserva ──────────────────────────────────────────
function abrirModalNovaReserva(salaId, dataISO, horaIni) {
  // Popular selects
  const selSala = document.getElementById('res-sala');
  const selProf = document.getElementById('res-prof');
  if (!selSala || !selProf) return;

  selSala.innerHTML = SALAS_CONECTA.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
  if (salaId) selSala.value = salaId;

  selProf.innerHTML = '<option value="">Selecione...</option>' +
    LOCATARIOS.filter(l => l.status === 'ativo').map(l => `<option value="${l.id}">${l.nome}</option>`).join('');

  // Data
  const resData = document.getElementById('res-data');
  if (resData) {
    resData.value = dataISO || new Date().toISOString().slice(0,10);
  }
  // Hora
  if (horaIni) document.getElementById('res-hora-ini').value = horaIni;

  document.getElementById('res-duracao').value = '60';
  document.getElementById('res-recorrencia').value = 'unica';
  document.getElementById('res-obs').value = '';
  conectaToggleRecorrencia();
  conectaCalcFim();
  openModal('modal-nova-reserva');
}

function conectaToggleRecorrencia() {
  const v = document.getElementById('res-recorrencia')?.value;
  const el = document.getElementById('res-recorr-ate-wrap');
  if (el) el.style.display = (v !== 'unica') ? '' : 'none';
}

function conectaCalcFim() {
  const ini = document.getElementById('res-hora-ini')?.value || '08:00';
  const dur = parseInt(document.getElementById('res-duracao')?.value || '60');
  const [h, m] = ini.split(':').map(Number);
  const totalMin = h * 60 + m + dur;
  const hFim = String(Math.floor(totalMin / 60) % 24).padStart(2,'0');
  const mFim = String(totalMin % 60).padStart(2,'0');
  const el = document.getElementById('res-hora-fim');
  if (el) el.value = `${hFim}:${mFim}`;

  // Preview de valor
  const locId = document.getElementById('res-prof')?.value;
  const loc = LOCATARIOS.find(l => l.id === locId);
  const valor = conectaCalcValor(loc, dur);
  const el2 = document.getElementById('res-valor-calc');
  const el3 = document.getElementById('res-valor-detalhe');
  if (el2) el2.textContent = brlFmt(valor);
  if (el3) {
    if (!loc) {
      el3.textContent = 'Selecione o profissional para calcular o valor';
    } else if (dur >= 480 && loc.valorDia) {
      el3.textContent = `Tarifa dia inteiro — ${(dur/60).toFixed(0)}h`;
    } else if (dur >= 210 && loc.valorMeio) {
      el3.textContent = `Tarifa meio período — ${(dur/60).toFixed(1)}h`;
    } else {
      el3.textContent = `${(dur/60).toFixed(1)}h × ${brlFmt(loc.valorHora)}/h`;
    }
  }
}

// Calcula valor baseado na duração e nas tabelas do locatário
function conectaCalcValor(loc, durMin) {
  if (!loc) return 0;
  if (durMin >= 480 && loc.valorDia) return loc.valorDia;
  if (durMin >= 210 && loc.valorMeio) return loc.valorMeio;
  return (durMin / 60) * (loc.valorHora || 0);
}

async function salvarReserva() {
  // Delega para o override com Supabase se disponível (definido no módulo de integração)
  if (window._salvarReservaSupabase) { return window._salvarReservaSupabase(); }

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
    showToast('Preencha todos os campos obrigatórios', 'error');
    return;
  }

  // Gerar lista de datas conforme recorrência
  const datas = [data];
  if (recorr !== 'unica' && recorrAte && recorrAte > data) {
    const intervalo = recorr === 'semanal' ? 7 : 14;
    let d = new Date(data + 'T12:00:00');
    const ate = new Date(recorrAte + 'T12:00:00');
    while (true) {
      d.setDate(d.getDate() + intervalo);
      if (d > ate) break;
      datas.push(d.toISOString().slice(0,10));
    }
  }

  let adicionadas = 0, conflitos = 0;
  datas.forEach(dt => {
    const conflito = RESERVAS_SALAS.some(r =>
      r.salaId === salaId && r.data === dt && r.status !== 'cancelado' &&
      !(horaFim <= r.horaIni || horaIni >= r.horaFim)
    );
    if (conflito) { conflitos++; return; }
    RESERVAS_SALAS.push({
      id: 'r' + Date.now() + '_' + adicionadas,
      salaId, locId, data: dt, horaIni, horaFim, durMin: dur,
      status: 'confirmado', obs, recorrencia: recorr
    });
    adicionadas++;
  });

  closeModal('modal-nova-reserva');
  conectaRenderAgenda();
  if (adicionadas > 0 && conflitos === 0) {
    showToast(`${adicionadas} reserva${adicionadas>1?'s':''} confirmada${adicionadas>1?'s':''}!`, 'success');
  } else if (adicionadas > 0 && conflitos > 0) {
    showToast(`${adicionadas} reserva${adicionadas>1?'s':''} confirmada${adicionadas>1?'s':''}. ${conflitos} conflito${conflitos>1?'s':''} ignorado${conflitos>1?'s':''}.`, 'success');
  } else {
    showToast('Conflito de horário — nenhuma reserva criada', 'error');
  }
}

// ── Profissionais Locatários ─────────────────────────────────────
function conectaRenderLocatarios() {
  const grid = document.getElementById('loc-profs-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (LOCATARIOS.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)">
      <div style="font-size:15px;font-weight:500">Nenhum profissional locatário cadastrado</div>
      <div style="font-size:13px;margin-top:6px">Clique em "Novo Locatário" para começar.</div>
    </div>`;
    return;
  }

  LOCATARIOS.forEach(loc => {
    const reservasMes = RESERVAS_SALAS.filter(r => {
      const now = new Date();
      const mes = now.toISOString().slice(0,7);
      return r.locId === loc.id && r.data.startsWith(mes) && r.status !== 'cancelado';
    });
    const horasMes = reservasMes.reduce((a,r) => a + r.durMin/60, 0);
    const valorMes = reservasMes.reduce((a,r) => a + conectaCalcValor(loc, r.durMin), 0);
    const salaPref = SALAS_CONECTA.find(s => s.id === loc.salaPref);

    const card = document.createElement('div');
    card.className = 'loc-prof-card';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'stretch';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div class="loc-avatar">${loc.nome.charAt(0)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${loc.nome}</div>
          <div style="font-size:12px;color:var(--text-muted)">${loc.esp || '—'}</div>
        </div>
        <span class="role-badge ${loc.status === 'ativo' ? 'recepcao' : 'prof'}">${loc.status}</span>
        <button class="btn-sm btn-secondary" style="padding:4px 10px;font-size:12px" onclick="editarLocatario('${loc.id}')">Editar</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="background:var(--bg-raised);border-radius:var(--radius-sm);padding:8px 10px;text-align:center">
          <div style="font-size:16px;font-weight:700;color:var(--info)">${brlFmt(loc.valorHora)}</div>
          <div style="font-size:10px;color:var(--text-muted)">por hora</div>
        </div>
        <div style="background:var(--bg-raised);border-radius:var(--radius-sm);padding:8px 10px;text-align:center">
          <div style="font-size:16px;font-weight:700;color:var(--warning)">${horasMes.toFixed(1)}h</div>
          <div style="font-size:10px;color:var(--text-muted)">este mês</div>
        </div>
        <div style="background:var(--bg-raised);border-radius:var(--radius-sm);padding:8px 10px;text-align:center">
          <div style="font-size:16px;font-weight:700;color:var(--success)">${brlFmt(valorMes)}</div>
          <div style="font-size:10px;color:var(--text-muted)">a faturar</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--text-muted)">
        ${loc.tel ? `<span>📞 ${loc.tel}</span>` : ''}
        ${salaPref ? `<span>🚪 ${salaPref.nome} (preferencial)</span>` : ''}
        ${loc.conselho ? `<span>🪪 ${loc.conselho}</span>` : ''}
      </div>
    `;
    grid.appendChild(card);
  });
}

function abrirModalNovoLocatario() {
  document.getElementById('loc-modal-title').textContent = 'Novo Profissional Locatário';
  document.getElementById('loc-edit-id').value = '';
  ['loc-nome','loc-esp','loc-tel','loc-email','loc-cpf','loc-conselho','loc-obs'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['loc-valor-hora','loc-valor-meio','loc-valor-dia'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('loc-status').value = 'ativo';

  // Popular select de sala preferencial
  const sel = document.getElementById('loc-sala-pref');
  if (sel) {
    sel.innerHTML = '<option value="">Sem preferência</option>' +
      SALAS_CONECTA.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
  }

  openModal('modal-novo-locatario');
}

function editarLocatario(locId) {
  const loc = LOCATARIOS.find(l => l.id === locId);
  if (!loc) return;
  document.getElementById('loc-modal-title').textContent = 'Editar Profissional Locatário';
  document.getElementById('loc-edit-id').value = loc.id;
  document.getElementById('loc-nome').value = loc.nome || '';
  document.getElementById('loc-esp').value = loc.esp || '';
  document.getElementById('loc-tel').value = loc.tel || '';
  document.getElementById('loc-email').value = loc.email || '';
  document.getElementById('loc-cpf').value = loc.cpf || '';
  document.getElementById('loc-conselho').value = loc.conselho || '';
  document.getElementById('loc-obs').value = loc.obs || '';
  document.getElementById('loc-valor-hora').value = loc.valorHora || '';
  document.getElementById('loc-valor-meio').value = loc.valorMeio || '';
  document.getElementById('loc-valor-dia').value = loc.valorDia || '';
  document.getElementById('loc-status').value = loc.status || 'ativo';

  const sel = document.getElementById('loc-sala-pref');
  if (sel) {
    sel.innerHTML = '<option value="">Sem preferência</option>' +
      SALAS_CONECTA.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
    sel.value = loc.salaPref || '';
  }

  openModal('modal-novo-locatario');
}

async function salvarLocatario() {
  // Delega para o override com Supabase se disponível (definido no módulo de integração)
  if (window._salvarLocatarioSupabase) { return window._salvarLocatarioSupabase(); }

  const nome = document.getElementById('loc-nome')?.value?.trim();
  if (!nome) {
    if (typeof showToast === 'function') showToast('Nome é obrigatório', 'error');
    return;
  }
  const editId = document.getElementById('loc-edit-id')?.value;

  const dados = {
    nome,
    esp:        document.getElementById('loc-esp')?.value || '',
    tel:        document.getElementById('loc-tel')?.value || '',
    email:      document.getElementById('loc-email')?.value || '',
    cpf:        document.getElementById('loc-cpf')?.value || '',
    conselho:   document.getElementById('loc-conselho')?.value || '',
    obs:        document.getElementById('loc-obs')?.value || '',
    valorHora:  parseFloat(document.getElementById('loc-valor-hora')?.value) || 0,
    valorMeio:  parseFloat(document.getElementById('loc-valor-meio')?.value) || 0,
    valorDia:   parseFloat(document.getElementById('loc-valor-dia')?.value) || 0,
    salaPref:   document.getElementById('loc-sala-pref')?.value || '',
    status:     document.getElementById('loc-status')?.value || 'ativo',
  };

  if (editId) {
    const idx = LOCATARIOS.findIndex(l => l.id === editId);
    if (idx >= 0) LOCATARIOS[idx] = { ...LOCATARIOS[idx], ...dados };
  } else {
    LOCATARIOS.push({ id: 'l' + Date.now(), ...dados });
  }

  closeModal('modal-novo-locatario');
  conectaRenderLocatarios();
  if (typeof showToast === 'function') showToast('Locatário salvo com sucesso!', 'success');
}

// ── Fechamento de Locação ────────────────────────────────────────
function calcularFechamentoLocacao() {
  const mesVal = document.getElementById('loc-fech-mes')?.value;
  if (!mesVal) { if (typeof showToast === 'function') showToast('Selecione o mês', 'error'); return; }

  const [ano, mes] = mesVal.split('-').map(Number);
  const ISO_PRIM = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const ISO_ULT  = new Date(ano, mes, 0).toISOString().slice(0,10);

  const reservasMes = RESERVAS_SALAS.filter(r =>
    r.status !== 'cancelado' && r.data >= ISO_PRIM && r.data <= ISO_ULT
  );

  // KPIs
  const totalReservas = reservasMes.length;
  const totalHoras = reservasMes.reduce((a,r) => a + r.durMin/60, 0);
  let totalValor = 0;
  LOCATARIOS.forEach(loc => {
    const resLoc = reservasMes.filter(r => r.locId === loc.id);
    totalValor += resLoc.reduce((a,r) => a + conectaCalcValor(loc, r.durMin), 0);
  });

  const kpisEl = document.getElementById('loc-fech-kpis');
  if (kpisEl) {
    kpisEl.style.display = 'grid';
    kpisEl.style.gridTemplateColumns = 'repeat(3,1fr)';
    kpisEl.style.gap = '14px';
    kpisEl.innerHTML = `
      <div class="table-card" style="padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:var(--info)">${totalReservas}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Reservas no mês</div>
      </div>
      <div class="table-card" style="padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:var(--warning)">${totalHoras.toFixed(1)}h</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Total de horas locadas</div>
      </div>
      <div class="table-card" style="padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:var(--success)">${brlFmt(totalValor)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Total a faturar</div>
      </div>
    `;
  }

  // Cards por profissional
  const cardsEl = document.getElementById('loc-fech-cards');
  const emptyEl = document.getElementById('loc-fech-empty');
  if (!cardsEl) return;
  cardsEl.innerHTML = '';

  const locComReservas = LOCATARIOS.filter(loc =>
    reservasMes.some(r => r.locId === loc.id)
  );

  if (locComReservas.length === 0) {
    if (emptyEl) emptyEl.style.display = '';
  } else {
    if (emptyEl) emptyEl.style.display = 'none';
    const mesLabel = new Date(ano, mes-1, 1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});

    locComReservas.forEach(loc => {
      const resLoc = reservasMes.filter(r => r.locId === loc.id);
      const horasTot = resLoc.reduce((a,r) => a + r.durMin/60, 0);
      const valorTot = resLoc.reduce((a,r) => a + conectaCalcValor(loc, r.durMin), 0);

      // Detalhe por sala
      const porSala = {};
      resLoc.forEach(r => {
        if (!porSala[r.salaId]) porSala[r.salaId] = { count:0, horas:0, valor:0 };
        porSala[r.salaId].count++;
        porSala[r.salaId].horas += r.durMin/60;
        porSala[r.salaId].valor += conectaCalcValor(loc, r.durMin);
      });

      const salaRows = Object.entries(porSala).map(([sId, d]) => {
        const sala = SALAS_CONECTA.find(s => s.id === sId);
        return `<div class="loc-fech-row">
          <span class="sala-pill ${sala?.cor||'sala1'}" style="font-size:11px;padding:2px 8px">${sala?.nome||sId}</span>
          <span style="color:var(--text-secondary)">${d.count} reserva${d.count>1?'s':''}</span>
          <span style="text-align:center">${d.horas.toFixed(1)}h</span>
          <span style="text-align:right;font-weight:500;color:var(--success)">${brlFmt(d.valor)}</span>
          <span></span>
        </div>`;
      }).join('');

      const detalhes = resLoc.map(r => {
        const sala = SALAS_CONECTA.find(s => s.id === r.salaId);
        const dt = new Date(r.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
        const val = conectaCalcValor(loc, r.durMin);
        return `<div class="loc-fech-row">
          <span style="font-family:var(--font-mono);font-size:11px">${dt}</span>
          <span style="color:var(--text-secondary)">${r.horaIni}–${r.horaFim} ${r.obs?'('+r.obs+')':''}</span>
          <span class="sala-pill ${sala?.cor||'sala1'}" style="font-size:10px;padding:1px 6px;justify-self:center">${sala?.nome||r.salaId}</span>
          <span style="text-align:right">${(r.durMin/60).toFixed(1)}h</span>
          <span style="text-align:right;font-weight:600;color:var(--success)">${brlFmt(val)}</span>
        </div>`;
      }).join('');

      const card = document.createElement('div');
      card.className = 'loc-fech-card';
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
          <div class="loc-avatar">${loc.nome.charAt(0)}</div>
          <div style="flex:1">
            <div style="font-size:15px;font-weight:600">${loc.nome}</div>
            <div style="font-size:12px;color:var(--text-muted)">${loc.esp||''} · ${loc.conselho||''}</div>
          </div>
          <div style="text-align:right">
            <div class="fech-total">${brlFmt(valorTot)}</div>
            <div style="font-size:11px;color:var(--text-muted)">${horasTot.toFixed(1)}h · ${resLoc.length} reserva${resLoc.length>1?'s':''}</div>
          </div>
        </div>

        <!-- Sumário por sala -->
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">Por sala</div>
        <div class="loc-fech-row header">
          <span>Sala</span><span>Reservas</span><span style="text-align:center">Horas</span><span style="text-align:right">Valor</span><span></span>
        </div>
        ${salaRows}

        <!-- Detalhe de todas as reservas -->
        <div style="margin-top:14px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">Detalhe das reservas</div>
        <div class="loc-fech-row header">
          <span>Data</span><span>Horário / Obs.</span><span style="text-align:center">Sala</span><span style="text-align:right">Horas</span><span style="text-align:right">Valor</span>
        </div>
        ${detalhes}

        <!-- Tabela de valores -->
        <div style="margin-top:14px;padding:10px 14px;background:var(--bg-raised);border-radius:var(--radius-sm);font-size:12px;display:flex;gap:20px;flex-wrap:wrap">
          <span style="color:var(--text-muted)">Valores cadastrados:</span>
          <span>Hora: <strong>${brlFmt(loc.valorHora)}</strong></span>
          <span>Meio período: <strong>${brlFmt(loc.valorMeio)}</strong></span>
          <span>Dia inteiro: <strong>${brlFmt(loc.valorDia)}</strong></span>
        </div>
      `;
      cardsEl.appendChild(card);
    });
  }

  const btnEmitir = document.getElementById('btn-emitir-loc');
  if (btnEmitir) btnEmitir.style.display = '';
  const btnConfirmar = document.getElementById('btn-confirmar-loc');
  if (btnConfirmar) btnConfirmar.style.display = '';
  if (typeof showToast === 'function') showToast('Fechamento de locação calculado!', 'success');
}

function confirmarFechamentoMes() {
  const mesVal = document.getElementById('loc-fech-mes')?.value;
  if (!mesVal) { showToast('Calcule o fechamento primeiro', 'error'); return; }
  if (!confirm(`Deseja registrar o fechamento de ${mesVal} no banco de dados? Esta ação pode ser refeita calculando novamente.`)) return;
  if (typeof window.confirmarFechamento === 'function') {
    window.confirmarFechamento(mesVal);
  } else {
    showToast('Supabase não conectado — fechamento apenas local', 'success');
  }
}

// ── Histórico de Fechamentos Confirmados ────────────────────────
function renderHistoricoFechamentos() {
  const el = document.getElementById('loc-fech-historico');
  if (!el) return;
  if (!FECHAMENTOS_CONECTA.length) {
    el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">Nenhum fechamento confirmado ainda</div>';
    return;
  }
  // Agrupa por competência
  const porComp = {};
  FECHAMENTOS_CONECTA.forEach(f => {
    if (!porComp[f.competencia]) porComp[f.competencia] = [];
    porComp[f.competencia].push(f);
  });
  const compOrdenadas = Object.keys(porComp).sort((a,b) => b.localeCompare(a));

  el.innerHTML = compOrdenadas.map(comp => {
    const itens = porComp[comp];
    const totalValor = itens.reduce((a,f) => a + (f.totalValor||0), 0);
    const totalHoras = itens.reduce((a,f) => a + (f.totalHoras||0), 0);
    const [ano, mes] = comp.split('-').map(Number);
    const label = new Date(ano, mes-1, 1).toLocaleDateString('pt-BR', {month:'long', year:'numeric'});
    const rows = itens.map(f => {
      const loc = LOCATARIOS.find(l => String(l.id) === String(f.locatarioId));
      return `<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border-light);font-size:12px">
        <span style="font-weight:500;color:var(--text-primary)">${loc?.nome || 'Locatário #' + f.locatarioId}</span>
        <span style="color:var(--text-muted)">${f.totalReservas} reserva${f.totalReservas>1?'s':''}</span>
        <span style="color:var(--text-secondary)">${(f.totalHoras||0).toFixed(1)}h</span>
        <span style="font-weight:600;color:var(--success)">${brlFmt(f.totalValor||0)}</span>
      </div>`;
    }).join('');
    return `<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span style="font-size:13px;font-weight:600;color:var(--text-primary);text-transform:capitalize">${label}</span>
        <div style="display:flex;gap:16px;font-size:12px">
          <span style="color:var(--text-muted)">${totalHoras.toFixed(1)}h</span>
          <span style="font-weight:700;color:var(--success)">${brlFmt(totalValor)}</span>
        </div>
      </div>
      ${rows}
    </div>`;
  }).join('');
}

// ── Relatório PDF Locação ────────────────────────────────────────
function emitirRelatorioLocacao() {
  const mesVal = document.getElementById('loc-fech-mes')?.value;
  if (!mesVal) { if (typeof showToast === 'function') showToast('Calcule o fechamento primeiro', 'error'); return; }

  const [ano, mes] = mesVal.split('-').map(Number);
  const ISO_PRIM = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const ISO_ULT  = new Date(ano, mes, 0).toISOString().slice(0,10);
  const mesLabel = new Date(ano, mes-1, 1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  const mesLabCap = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);
  const dataEmis = new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const clinNome = (typeof CLINICA !== 'undefined' && CLINICA?.nome) ? CLINICA.nome : 'ClinicFlow';

  const reservasMes = RESERVAS_SALAS.filter(r =>
    r.status !== 'cancelado' && r.data >= ISO_PRIM && r.data <= ISO_ULT
  );

  let totalValor = 0;
  const rows = LOCATARIOS
    .filter(loc => reservasMes.some(r => r.locId === loc.id))
    .map(loc => {
      const resLoc = reservasMes.filter(r => r.locId === loc.id);
      const horas = resLoc.reduce((a,r) => a + r.durMin/60, 0);
      const valor = resLoc.reduce((a,r) => a + conectaCalcValor(loc, r.durMin), 0);
      totalValor += valor;
      const fmt = v => 'R$ ' + v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">${loc.nome}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">${loc.esp||'—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center">${resLoc.length}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center">${horas.toFixed(1)}h</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${fmt(loc.valorHora)}/h</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#16a34a">${fmt(valor)}</td>
      </tr>`;
    }).join('');

  const fmtBrl = v => 'R$ ' + v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Fechamento Locação de Salas — ${mesLabCap}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1e293b; background: #fff; padding: 18mm 15mm; }
  .header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #1e3a6e; padding-bottom: 12px; }
  .header h1 { font-size: 16pt; color: #1e3a6e; margin-bottom: 2px; }
  .header h2 { font-size: 12pt; color: #0e7490; margin-bottom: 4px; }
  .header p  { font-size: 10pt; color: #475569; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 8.5pt; color: #64748b; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  thead tr { background: #1e3a6e; color: #fff; }
  thead th { padding: 8px 10px; text-align: left; font-weight: 600; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .tfoot tr { background: #e8f0fe !important; font-weight: 700; }
  .tfoot td { padding: 10px 10px; border-top: 2px solid #1e3a6e; font-size: 10pt; }
  .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 8pt; color: #94a3b8; text-align: center; }
  @media print { body { padding: 10mm 12mm; } }
</style>
</head>
<body>
<div class="header">
  <h1>${clinNome}</h1>
  <h2>🏢 Espaço Conecta</h2>
  <p>Fechamento de Locação de Salas — <strong>${mesLabCap}</strong></p>
</div>
<div class="meta">
  <span>Emitido em: ${dataEmis}</span>
  <span>Competência: <strong>${mesLabCap}</strong></span>
</div>
<table>
  <thead>
    <tr>
      <th>Profissional Locatário</th>
      <th>Especialidade</th>
      <th style="text-align:center">Reservas</th>
      <th style="text-align:center">Horas</th>
      <th style="text-align:right">Valor/h</th>
      <th style="text-align:right">Total a Cobrar</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot class="tfoot">
    <tr>
      <td colspan="2"><strong>TOTAL GERAL</strong></td>
      <td colspan="3" style="text-align:center;font-size:8.5pt;color:#475569">— — —</td>
      <td style="text-align:right;color:#16a34a;font-size:11pt"><strong>${fmtBrl(totalValor)}</strong></td>
    </tr>
  </tfoot>
</table>
<div class="footer">
  Documento gerado automaticamente pelo ClinicFlow · Espaço Conecta · Apenas reservas com status "Confirmado"
</div>
<script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) { win.document.write(html); win.document.close(); }
  else {
    const blob = new Blob([html], {type:'text/html'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `locacao_salas_${mesVal}.html`;
    a.click();
    if (typeof showToast === 'function') showToast('Arquivo baixado — abra no navegador e use Ctrl+P para salvar PDF','success');
  }
}

// Helper BRL — usa a função global brlFmt já existente no sistema
// (definida em ~linha 14594)

// Esconde botão "Nova Reserva" para perfil financeiro (só pode ver)
document.addEventListener('DOMContentLoaded', function() {
  // Reavaliar visibilidade baseada no papel do usuário
  const origGotoPage = typeof gotoPage === 'function' ? gotoPage : null;
});

console.log('[ClinicFlow] Módulo Espaço Conecta — Locação de Salas carregado ✓');


// ═══════════════════════════════════════════════════════════════
