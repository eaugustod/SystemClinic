<script>
/* ═══════════════════════════════════════════════════
   MÓDULO: USUÁRIOS & CONTROLE DE ACESSO
   + WEBCAM REUTILIZÁVEL PARA FOTO
═══════════════════════════════════════════════════ */

// ── Estado ──────────────────────────────────────────
let USUARIOS = JSON.parse(localStorage.getItem('cf_usuarios') || '[]');
if (!USUARIOS.length) {
  // Usuário admin padrão
  USUARIOS = [{
    id: 'usr-1',
    nome: 'Administrador',
    email: 'admin',
    cpf: '',
    rg: '',
    tel: '',
    nasc: '',
    perfil: 'admin',
    status: 'Ativo',
    foto: '',
    senha: 'admin',
    criadoEm: new Date().toISOString()
  }];
  salvarUsuariosLocal();
} else {
  // Migração: garante que o admin padrão existe e tem a senha correta
  const admIdx = USUARIOS.findIndex(u => u.email === 'admin' && u.perfil === 'admin');
  if (admIdx === -1) {
    USUARIOS.unshift({
      id: 'usr-1', nome: 'Administrador', email: 'admin',
      cpf: '', rg: '', tel: '', nasc: '', perfil: 'admin',
      status: 'Ativo', foto: '', senha: 'admin',
      criadoEm: new Date().toISOString()
    });
    salvarUsuariosLocal();
  } else if (USUARIOS[admIdx].senha === 'admin123') {
    // Corrige senha legada
    USUARIOS[admIdx].senha = 'admin';
    salvarUsuariosLocal();
  }
}

let _editUsuarioId = null;
let _webcamStream = null;
let _webcamAlvo = null; // 'paciente' | 'profissional' | 'usuario'
let _webcamCapturedData = null;

function salvarUsuariosLocal() {
  localStorage.setItem('cf_usuarios', JSON.stringify(USUARIOS));
}

// ── Renderização ─────────────────────────────────────
function renderUsuarios() {
  const tbody = document.getElementById('usuarios-tbody');
  if (!tbody) return;

  // contadores de perfil
  const counts = { admin: 0, recepcao: 0, prof: 0 };
  USUARIOS.forEach(u => { if (counts[u.perfil] !== undefined) counts[u.perfil]++; });
  const cA = document.getElementById('usr-count-admin');
  const cR = document.getElementById('usr-count-recepcao');
  const cP = document.getElementById('usr-count-prof');
  if (cA) cA.textContent = counts.admin;
  if (cR) cR.textContent = counts.recepcao;
  if (cP) cP.textContent = counts.prof;

  tbody.innerHTML = USUARIOS.map(u => {
    const perfilLabel = { admin: '👑 Admin', recepcao: '📋 Recepção', prof: '🩺 Profissional' }[u.perfil] || u.perfil;
    const perfilColor = { admin: 'var(--accent)', recepcao: 'var(--success)', prof: 'var(--warning)' }[u.perfil] || 'var(--text-muted)';
    const foto = u.foto
      ? `<img src="${u.foto}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid var(--border-mid)">`
      : `<div style="width:34px;height:34px;border-radius:50%;background:var(--bg-raised);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--text-secondary);border:2px solid var(--border-mid)">${(u.nome||'?')[0].toUpperCase()}</div>`;
    const statusChip = u.status === 'Ativo'
      ? `<span class="chip green" style="font-size:11px">Ativo</span>`
      : `<span class="chip gray" style="font-size:11px">Inativo</span>`;
    const profVinc = u.profId
      ? (() => { const pf = PROFISSIONAIS.find(p => p.id === u.profId); return pf ? `<span style="font-size:12px;color:var(--warning)">🩺 ${pf.nome}</span>` : `<span style="font-size:11px;color:var(--text-muted)">ID:${u.profId} (não encontrado)</span>`; })()
      : `<span style="font-size:11px;color:var(--text-muted)">—</span>`;
    return `<tr>
      <td>${foto}</td>
      <td style="font-weight:500">${u.nome}</td>
      <td style="color:var(--text-muted)">${u.email}</td>
      <td style="font-family:var(--font-mono);font-size:12px">${u.cpf || '—'}</td>
      <td>${u.tel || '—'}</td>
      <td><span style="font-size:12px;font-weight:500;color:${perfilColor}">${perfilLabel}</span></td>
      <td>${profVinc}</td>
      <td>${statusChip}</td>
      <td style="text-align:right">
        <div style="display:flex;gap:4px;justify-content:flex-end">
          <button class="btn-sm btn-secondary" style="padding:5px 10px;font-size:12px;gap:5px;display:flex;align-items:center" onclick="editarUsuario('${u.id}')">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px;flex-shrink:0"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            Editar
          </button>
          <button class="btn-sm btn-secondary" style="padding:5px 10px;font-size:12px;gap:5px;display:flex;align-items:center;color:var(--danger)" onclick="excluirUsuario('${u.id}')">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px;flex-shrink:0"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            Excluir
          </button>
        </div>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:32px">Nenhum usuário cadastrado</td></tr>`;
}

function filterUsuarios(q) {
  const rows = document.querySelectorAll('#usuarios-tbody tr');
  const lq = q.toLowerCase();
  rows.forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(lq) ? '' : 'none';
  });
}

// ── Abrir / Editar ───────────────────────────────────
function abrirNovoUsuario() {
  _editUsuarioId = null;
  document.getElementById('usr-modal-title').textContent = 'Novo Usuário';
  document.getElementById('usr-modal-sub').textContent = 'Preencha os dados do usuário do sistema';
  document.getElementById('usr-id-display').textContent = '';
  ['usr-nome','usr-email','usr-cpf','usr-rg','usr-tel','usr-senha','usr-senha-conf'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('usr-perfil').value = 'admin';
  document.getElementById('usr-status').value = 'Ativo';
  document.getElementById('usr-nasc').value = '';
  document.getElementById('usr-foto-data').value = '';
  const wrap = document.getElementById('usr-foto-wrap');
  wrap.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" style="width:28px;height:28px;color:var(--text-muted)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
  _popularSelectProfissionaisUsuario(null);
  document.getElementById('usr-prof-vinculo-wrap').style.display = 'none';
  document.getElementById('modal-usuario').classList.add('active');
}

function editarUsuario(id) {
  // Busca tolerando id numérico ou string
  const u = USUARIOS.find(x => String(x.id) === String(id));
  if (!u) { showToast('Usuário não encontrado', 'error'); return; }
  _editUsuarioId = u.id; // guarda o id original (pode ser number ou string)
  document.getElementById('usr-modal-title').textContent = 'Editar Usuário';
  document.getElementById('usr-modal-sub').textContent = 'Atualize os dados do usuário';
  document.getElementById('usr-id-display').textContent = 'ID: ' + u.id;
  document.getElementById('usr-nome').value = u.nome || '';
  document.getElementById('usr-email').value = u.email || '';
  document.getElementById('usr-cpf').value = u.cpf || '';
  document.getElementById('usr-rg').value = u.rg || '';
  document.getElementById('usr-tel').value = u.tel || '';
  document.getElementById('usr-nasc').value = u.nasc || '';
  document.getElementById('usr-perfil').value = u.perfil || 'admin';
  document.getElementById('usr-status').value = u.status || 'Ativo';
  document.getElementById('usr-foto-data').value = u.foto || '';
  document.getElementById('usr-senha').value = '';
  document.getElementById('usr-senha-conf').value = '';
  const wrap = document.getElementById('usr-foto-wrap');
  if (u.foto) {
    wrap.innerHTML = `<img src="${u.foto}" style="width:100%;height:100%;object-fit:cover">`;
  } else {
    wrap.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" style="width:28px;height:28px;color:var(--text-muted)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
  }
  _popularSelectProfissionaisUsuario(u.profId || null);
  const vincWrap = document.getElementById('usr-prof-vinculo-wrap');
  if (vincWrap) vincWrap.style.display = u.perfil === 'prof' ? '' : 'none';
  document.getElementById('modal-usuario').classList.add('active');
}

// ── Salvar ───────────────────────────────────────────
function salvarUsuario() {
  const nome = document.getElementById('usr-nome').value.trim();
  const email = document.getElementById('usr-email').value.trim();
  const cpf = document.getElementById('usr-cpf').value.trim();
  const rg = document.getElementById('usr-rg').value.trim();
  const tel = document.getElementById('usr-tel').value.trim();
  const nasc = document.getElementById('usr-nasc').value;
  const perfil = document.getElementById('usr-perfil').value;
  const status = document.getElementById('usr-status').value;
  const foto = document.getElementById('usr-foto-data').value;
  const senha = document.getElementById('usr-senha').value;
  const senhaConf = document.getElementById('usr-senha-conf').value;

  if (!nome) { showToast('Informe o nome do usuário', 'error'); return; }
  if (!email) { showToast('Informe o e-mail', 'error'); return; }
  if (!_editUsuarioId && !senha) { showToast('Informe a senha', 'error'); return; }
  if (senha && senha !== senhaConf) { showToast('As senhas não coincidem', 'error'); return; }
  if (senha && senha.length < 6) { showToast('A senha deve ter mínimo 6 caracteres', 'error'); return; }

  // Verifica email duplicado
  const duplicado = USUARIOS.find(u => u.email === email && String(u.id) !== String(_editUsuarioId));
  if (duplicado) { showToast('Já existe um usuário com este e-mail', 'error'); return; }

  const profIdVal = perfil === 'prof' ? (parseInt(document.getElementById('usr-prof-id')?.value || '0') || null) : null;

  if (_editUsuarioId) {
    const u = USUARIOS.find(x => String(x.id) === String(_editUsuarioId));
    if (u) {
      u.nome = nome; u.email = email; u.cpf = cpf; u.rg = rg;
      u.tel = tel; u.nasc = nasc; u.perfil = perfil; u.status = status;
      u.foto = foto;
      u.profId = profIdVal;
      if (perfilCustomId) u.perfilId = perfilCustomId; else delete u.perfilId;
      if (senha) u.senha = senha;
      // Persiste update individual no Supabase
      _upsertUsuarioSupabase(u);
    }
    showToast('Usuário atualizado!', 'success');
  } else {
    const novoUsuario = {
      id: 'usr-' + Date.now(),
      nome, email, cpf, rg, tel, nasc, perfil, status, foto,
      senha: senha,
      profId: profIdVal,
      ...(perfilCustomId ? { perfilId: perfilCustomId } : {}),
      criadoEm: new Date().toISOString()
    };
    USUARIOS.push(novoUsuario);
    // Persiste insert individual no Supabase
    _upsertUsuarioSupabase(novoUsuario);
    showToast('Usuário cadastrado!', 'success');
  }

  salvarUsuariosLocal();
  closeModal('modal-usuario');
  renderUsuarios();

  // Atualiza avatar da sidebar se for o usuário logado
  atualizarAvatarSidebar();

  // sincroniza com Supabase se disponível
  sincronizarUsuarioSupabase();
}

function atualizarAvatarSidebar() {
  if (!currentUser) return;
  const emailAtual = (document.getElementById('login-email')?.value || '').trim().toLowerCase();
  const role = currentUser.role;
  const usuarioCadastrado = USUARIOS.find(u =>
    u.email && u.email.toLowerCase() === emailAtual && u.perfil === role
  );
  const foto = usuarioCadastrado?.foto || currentUser.foto || '';
  const nome = usuarioCadastrado?.nome || currentUser.nome || '';
  const initials = nome.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase() || currentUser.initials || '?';
  const avatarEl = document.getElementById('sidebar-avatar');
  if (!avatarEl) return;
  if (foto) {
    avatarEl.innerHTML = `<img src="${foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    avatarEl.style.padding = '0';
    avatarEl.style.overflow = 'hidden';
    avatarEl.style.background = 'transparent';
  } else {
    avatarEl.textContent = initials;
    avatarEl.style.padding = '';
    avatarEl.style.overflow = '';
    avatarEl.style.background = '';
  }
  document.getElementById('sidebar-username').textContent = nome;
}

function excluirUsuario(id) {
  if (USUARIOS.length <= 1) { showToast('Deve existir ao menos um usuário', 'error'); return; }
  const u = USUARIOS.find(x => String(x.id) === String(id));
  if (!u) return;
  if (!confirm(`Excluir o usuário "${u.nome}"? Esta ação não pode ser desfeita.`)) return;
  const i = USUARIOS.findIndex(x => String(x.id) === String(id));
  if (i > -1) USUARIOS.splice(i, 1);
  salvarUsuariosLocal();
  renderUsuarios();
  showToast('Usuário excluído.', 'error');
  // Remove do Supabase
  try {
    const sb = window._cfGetDb ? window._cfGetDb() : null;
    if (sb) sb.from('usuarios').delete().eq('id', id).then(({ error: e }) => {
      if (e) console.error('[ClinicFlow] Erro ao excluir usuário do Supabase:', e.message);
    });
  } catch(_e) {}
}

// ── Persiste um único usuário no Supabase (upsert) ────────────────────
async function _upsertUsuarioSupabase(u) {
  try {
    const sb = window._cfGetDb ? window._cfGetDb() : null;
    if (!sb) return;
    const payload = {
      id: u.id, nome: u.nome, email: u.email, cpf: u.cpf || null, rg: u.rg || null,
      telefone: u.tel || null, data_nascimento: u.nasc || null,
      perfil: u.perfil, status: u.status, foto: u.foto || null,
      prof_id: u.profId || null, perfil_id: u.perfilId || null,
      created_at: u.criadoEm || new Date().toISOString()
    };
    if (u.senha) payload.senha = u.senha;
    const { error } = await sb.from('usuarios').upsert([payload], { onConflict: 'id' });
    if (error) console.error('[ClinicFlow] Erro ao salvar usuário no Supabase:', error.message);
  } catch(e) { console.warn('[ClinicFlow] _upsertUsuarioSupabase:', e.message); }
}

async function sincronizarUsuarioSupabase() {
  try {
    const sb = window._cfGetDb ? window._cfGetDb() : null;
    if (!sb) return;
    // Upsert em massa (chamado no sync geral)
    const payload = USUARIOS.map(u => ({
      id: u.id, nome: u.nome, email: u.email, cpf: u.cpf || null, rg: u.rg || null,
      telefone: u.tel || null, data_nascimento: u.nasc || null,
      perfil: u.perfil, status: u.status, foto: u.foto || null,
      prof_id: u.profId || null, perfil_id: u.perfilId || null,
      created_at: u.criadoEm || new Date().toISOString()
    }));
    const { error } = await sb.from('usuarios').upsert(payload, { onConflict: 'id' });
    if (error) console.error('[ClinicFlow] Erro ao sincronizar usuários:', error.message);
  } catch(e) { /* tabela pode não existir ainda */ }
}

// ── Carrega usuários do Supabase (chamado no sync principal) ──────────
async function carregarUsuariosSupabase() {
  try {
    const sb = window._cfGetDb ? window._cfGetDb() : null;
    if (!sb) return;
    const { data, error } = await sb.from('usuarios').select('*').order('nome').limit(500);
    if (error || !data || !data.length) return;
    USUARIOS.length = 0;
    data.forEach(r => {
      const _pr = (r.perfil || '').toLowerCase().trim();
      const _rn = _pr === 'admin' || _pr === 'administrador' ? 'admin'
                : _pr === 'recepcao' || _pr === 'recepção' ? 'recepcao'
                : _pr === 'prof' || _pr === 'profissional' ? 'prof'
                : _pr || 'recepcao';
      USUARIOS.push({
        id: String(r.id),
        nome: r.nome, email: r.email, cpf: r.cpf || '',
        rg: r.rg || '', tel: r.telefone || '', nasc: r.data_nascimento || '',
        perfil: _rn, status: r.status || 'Ativo',
        foto: r.foto || '', senha: r.senha || '',
        profId: r.prof_id || null,
        perfilId: r.perfil_id || r.perfilId || null,
        criadoEm: r.created_at || ''
      });
    });
    salvarUsuariosLocal();
    renderUsuarios();
  } catch(e) { console.warn('[ClinicFlow] Tabela usuarios não encontrada, usando localStorage', e.message); }
}

// ── Popula o select de profissionais no modal de usuário ──────────────
function _popularSelectProfissionaisUsuario(selectedProfId) {
  const sel = document.getElementById('usr-prof-id');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Selecione o profissional —</option>' +
    PROFISSIONAIS.filter(p => p.status !== 'Inativo').map(p =>
      `<option value="${p.id}" ${p.id === selectedProfId ? 'selected' : ''}>${p.nome}${p.esp ? ' — ' + p.esp : ''}</option>`
    ).join('');
}

// ── Mostra/oculta o bloco de vínculo ao mudar o perfil ───────────────
function onUsrPerfilChange(val) {
  const wrap = document.getElementById('usr-prof-vinculo-wrap');
  if (!wrap) return;
  wrap.style.display = val === 'prof' ? '' : 'none';
  if (val === 'prof') _popularSelectProfissionaisUsuario(null);
}

// ── Masks ────────────────────────────────────────────
function maskCPF(el) {
  let v = el.value.replace(/\D/g,'').slice(0,11);
  if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/,'$1.$2.$3-$4');
  else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/,'$1.$2.$3');
  else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/,'$1.$2');
  el.value = v;
}
function maskTelefone(el) {
  let v = el.value.replace(/\D/g,'').slice(0,11);
  if (v.length > 10) v = v.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3');
  else if (v.length > 6) v = v.replace(/(\d{2})(\d{4,5})(\d{0,4})/,'($1) $2-$3');
  else if (v.length > 2) v = v.replace(/(\d{2})(\d+)/,'($1) $2');
  el.value = v;
}

// ── Mostrar/ocultar senha ────────────────────────────
function toggleSenhaVis(inputId, iconId) {
  const inp = document.getElementById(inputId);
  const ico = document.getElementById(iconId);
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    ico.innerHTML = `<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>`;
  } else {
    inp.type = 'password';
    ico.innerHTML = `<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>`;
  }
}

// ── Foto genérica (arquivo) ──────────────────────────
function previewPhotoTarget(input, wrapId, hiddenId) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const data = e.target.result;
    const wrap = document.getElementById(wrapId);
    if (wrap) wrap.innerHTML = `<img src="${data}" style="width:100%;height:100%;object-fit:cover">`;
    const hid = document.getElementById(hiddenId);
    if (hid) hid.value = data;
  };
  reader.readAsDataURL(file);
}

function triggerPhotoModal(alvo) {
  document.getElementById('foto-' + alvo)?.click();
}

// ── Webcam ──────────────────────────────────────────
function abrirWebcam(alvo) {
  _webcamAlvo = alvo;
  _webcamCapturedData = null;
  const overlay = document.getElementById('modal-webcam');
  overlay.classList.add('active');

  const video = document.getElementById('webcam-video');
  const preview = document.getElementById('webcam-preview-wrap');
  const btnNova = document.getElementById('webcam-btn-nova');
  const btnRepetir = document.getElementById('webcam-btn-repetir');
  const btnUsar = document.getElementById('webcam-btn-usar');

  preview.style.display = 'none';
  btnRepetir.style.display = 'none';
  btnUsar.style.display = 'none';
  btnNova.textContent = '📷 Capturar';
  btnNova.style.display = 'flex';

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
    .then(stream => {
      _webcamStream = stream;
      video.srcObject = stream;
    })
    .catch(err => {
      fecharWebcam();
      showToast('Webcam não encontrada ou permissão negada: ' + err.message, 'error');
    });
}

function webcamCapturar() {
  const video = document.getElementById('webcam-video');
  const canvas = document.getElementById('webcam-canvas');
  const w = video.videoWidth || 400;
  const h = video.videoHeight || 300;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, w, h);
  _webcamCapturedData = canvas.toDataURL('image/jpeg', 0.85);

  const previewImg = document.getElementById('webcam-preview-img');
  previewImg.src = _webcamCapturedData;
  document.getElementById('webcam-preview-wrap').style.display = 'flex';
  document.getElementById('webcam-btn-nova').style.display = 'none';
  document.getElementById('webcam-btn-repetir').style.display = 'flex';
  document.getElementById('webcam-btn-usar').style.display = 'flex';
}

function webcamRepetir() {
  _webcamCapturedData = null;
  document.getElementById('webcam-preview-wrap').style.display = 'none';
  document.getElementById('webcam-btn-nova').style.display = 'flex';
  document.getElementById('webcam-btn-repetir').style.display = 'none';
  document.getElementById('webcam-btn-usar').style.display = 'none';
}

function webcamUsar() {
  if (!_webcamCapturedData) return;
  const alvo = _webcamAlvo;

  if (alvo === 'paciente') {
    const wrap = document.getElementById('pac-foto-wrap');
    if (wrap) wrap.style.backgroundImage = `url(${_webcamCapturedData})`;
    if (wrap) wrap.style.backgroundSize = 'cover';
    if (wrap) wrap.innerHTML = `<img src="${_webcamCapturedData}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-md)">`;
    const hid = document.getElementById('pac-foto-data');
    if (hid) hid.value = _webcamCapturedData;
  } else if (alvo === 'profissional') {
    const wrap = document.getElementById('prf-foto-wrap');
    if (wrap) wrap.innerHTML = `<img src="${_webcamCapturedData}" style="width:100%;height:100%;object-fit:cover">`;
    const hid = document.getElementById('prf-foto-data');
    if (hid) hid.value = _webcamCapturedData;
  } else if (alvo === 'usuario') {
    const wrap = document.getElementById('usr-foto-wrap');
    if (wrap) wrap.innerHTML = `<img src="${_webcamCapturedData}" style="width:100%;height:100%;object-fit:cover">`;
    const hid = document.getElementById('usr-foto-data');
    if (hid) hid.value = _webcamCapturedData;
  }

  fecharWebcam();
  showToast('Foto capturada pela webcam!', 'success');
}

function fecharWebcam() {
  if (_webcamStream) {
    _webcamStream.getTracks().forEach(t => t.stop());
    _webcamStream = null;
  }
  const video = document.getElementById('webcam-video');
  if (video) video.srcObject = null;
  document.getElementById('modal-webcam').classList.remove('active');
}

// ── Override gotoPage para inicializar módulo ────────
const _origGotoPage = window.gotoPage;
window.gotoPage = function(page, el) {
  _origGotoPage && _origGotoPage(page, el);
  if (page === 'usuarios') {
    try { renderUsuarios(); } catch(e) { console.warn('[gotoPage usuarios]', e); }
    try { if (typeof carregarUsuariosSupabase === 'function') carregarUsuariosSupabase(); } catch(_e) {}
  }
  if (page === 'perfis') {
    try { renderPerfisLista(); } catch(e) { console.warn('[gotoPage perfis]', e); }
  }
  if (page === 'fechamento') {
    const mesInput = document.getElementById('fech-mes');
    if (mesInput && !mesInput.value) {
      const now = new Date();
      mesInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2,'0');
    }
    try { if (typeof renderFechamento === 'function') renderFechamento(); } catch(_e) {}
  }
  if (page === 'conecta-agenda') {
    try { conectaRenderAgenda(); } catch(e) { console.warn('[gotoPage conecta-agenda]', e); }
  }
  if (page === 'conecta-profissionais') {
    try { conectaRenderLocatarios(); } catch(e) { console.warn('[gotoPage conecta-profissionais]', e); }
  }
  if (page === 'conecta-fechamento') {
    try { renderHistoricoFechamentos(); } catch(e) { console.warn('[gotoPage conecta-fechamento]', e); }
  }
};

// ── Override previewPhoto para paciente (manter compat.) ─
const _origPreviewPhoto = window.previewPhoto;
window.previewPhoto = function(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const data = e.target.result;
    const wrap = document.getElementById('pac-foto-wrap');
    if (wrap) wrap.innerHTML = `<img src="${data}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-md)">`;
    const hid = document.getElementById('pac-foto-data');
    if (hid) hid.value = data;
    // também executa o original se existir
    if (_origPreviewPhoto && _origPreviewPhoto !== window.previewPhoto) _origPreviewPhoto(input);
  };
  reader.readAsDataURL(file);
};

// Inicializa contadores ao carregar
document.addEventListener('DOMContentLoaded', function() {
  // Esconde item de Usuários se não for admin (demo logic)
  const navItem = document.getElementById('nav-usuarios-item');
  // O controle de visibilidade real é feito pelo applyRoleRestrictions existente
});

console.log('[ClinicFlow] Módulo Usuários & Webcam carregado ✓');

// ═══════════════════════════════════════════════════════════════════════════
