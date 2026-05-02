// ═══════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════
// quickLogin desabilitado — acesso apenas por email + senha
function quickLogin(role) {
  console.warn('[ClinicFlow] Acesso rápido desabilitado. Use email e senha.');
}

async function doLogin() {
  const emailInput = (document.getElementById('login-email')?.value || '').trim().toLowerCase();
  const senhaInput = (document.getElementById('login-pass')?.value || '');
  const errEl      = document.getElementById('login-error');
  const btnEl      = document.getElementById('btn-login');

  errEl.style.display = 'none';
  errEl.textContent   = '';

  if (!emailInput || !senhaInput) {
    errEl.textContent   = '⚠ Preencha o e-mail e a senha.';
    errEl.style.display = 'block';
    return;
  }

  btnEl.disabled    = true;
  btnEl.textContent = 'Verificando...';

  // ── Tenta autenticar via Supabase ─────────────────────────────────────────
  const cfgUrl = localStorage.getItem('cf_supa_url') || '';
  const cfgKey = localStorage.getItem('cf_supa_key') || '';

  if (cfgUrl && cfgKey && window.supabase) {
    try {
      // Reutiliza singleton global — nunca cria novo GoTrueClient
      const _sbLogin = window.__cfSb
        || (window._cfGetOrCreateClient
            ? window._cfGetOrCreateClient(cfgUrl, cfgKey)
            : window.supabase.createClient(cfgUrl, cfgKey));

      const { data: rows, error } = await _sbLogin
        .from('usuarios')
        .select('*')
        .eq('email', emailInput)
        .limit(1);

      if (error) throw error;

      const usuario = rows && rows[0];

      if (!usuario) {
        errEl.textContent   = '✗ E-mail não encontrado. Verifique com o administrador.';
        errEl.style.display = 'block';
        btnEl.disabled      = false;
        btnEl.textContent   = 'Entrar';
        return;
      }

      // Valida senha (campo 'senha' na tabela usuarios)
      const senhaCorreta = (usuario.senha || usuario.password || '').trim();
      if (!senhaCorreta || senhaCorreta !== senhaInput) {
        errEl.textContent   = '✗ Senha incorreta.';
        errEl.style.display = 'block';
        btnEl.disabled      = false;
        btnEl.textContent   = 'Entrar';
        return;
      }

      if ((usuario.status || 'Ativo') !== 'Ativo') {
        errEl.textContent   = '✗ Usuário inativo. Contate o administrador.';
        errEl.style.display = 'block';
        btnEl.disabled      = false;
        btnEl.textContent   = 'Entrar';
        return;
      }

      // Login bem-sucedido via Supabase
      // Normaliza o campo perfil para os valores internos ('admin','recepcao','prof')
      const _perfilRaw = (usuario.perfil || '').toLowerCase().trim();
      const _roleNorm  = _perfilRaw === 'admin' || _perfilRaw === 'administrador' ? 'admin'
                       : _perfilRaw === 'recepcao' || _perfilRaw === 'recepção' ? 'recepcao'
                       : _perfilRaw === 'prof' || _perfilRaw === 'profissional' ? 'prof'
                       : _perfilRaw || 'recepcao';
      _finalizarLogin({
        nome:     usuario.nome     || emailInput,
        role:     _roleNorm,
        initials: (usuario.nome || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase(),
        foto:     usuario.foto     || '',
        id:       usuario.id,
        perfilId: usuario.perfil_id || usuario.perfilId || null,
      });
      return;

    } catch (err) {
      console.error('[ClinicFlow] Erro Supabase login:', err);
      errEl.textContent   = '✗ Erro ao conectar ao servidor. Verifique a conexão.';
      errEl.style.display = 'block';
      btnEl.disabled      = false;
      btnEl.textContent   = 'Entrar';
      return;
    }
  }

  // ── Fallback: Supabase não configurado ────────────────────────────────────
  // Verifica na lista local de usuários (apenas para admin inicial)
  const usuarioLocal = (typeof USUARIOS !== 'undefined' ? USUARIOS : [])
    .find(u => u.email && u.email.toLowerCase() === emailInput && u.perfil === 'admin');

  if (usuarioLocal) {
    const senhaLocal = (usuarioLocal.senha || '').trim();
    if (!senhaLocal || senhaLocal !== senhaInput) {
      errEl.textContent   = '✗ Senha incorreta.';
      errEl.style.display = 'block';
      btnEl.disabled      = false;
      btnEl.textContent   = 'Entrar';
      return;
    }
    _finalizarLogin({
      nome:     usuarioLocal.nome     || 'Administrador',
      role:     'admin',
      initials: (usuarioLocal.nome || 'AD').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase(),
      foto:     usuarioLocal.foto     || '',
      id:       usuarioLocal.id,
    });
    showToast('⚠ Supabase não configurado. Configure em Configurações > Supabase para habilitar todos os usuários.', 'warning');
    return;
  }

  errEl.textContent   = '✗ Acesso negado. Configure o Supabase ou use as credenciais de administrador.';
  errEl.style.display = 'block';
  btnEl.disabled      = false;
  btnEl.textContent   = 'Entrar';
}

function _finalizarLogin(user) {
  currentUser = user;
  const role  = user.role;

  const avatarEl = document.getElementById('sidebar-avatar');
  if (user.foto) {
    avatarEl.innerHTML = `<img src="${user.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    avatarEl.className = `user-avatar ${role}`;
    avatarEl.style.padding    = '0';
    avatarEl.style.overflow   = 'hidden';
    avatarEl.style.background = 'transparent';
  } else {
    avatarEl.textContent      = user.initials;
    avatarEl.className        = `user-avatar ${role}`;
    avatarEl.style.padding    = '';
    avatarEl.style.overflow   = '';
    avatarEl.style.background = '';
  }

  document.getElementById('sidebar-username').textContent = user.nome;
  const badge = document.getElementById('sidebar-badge');
  badge.textContent = role === 'recepcao' ? 'Recepção' : role.charAt(0).toUpperCase() + role.slice(1);
  badge.className   = `role-badge ${role}`;

  if (role === 'prof') {
    document.getElementById('nav-admin-section').style.display  = 'none';
    document.getElementById('nav-config-section').style.display = 'none';
  }
  if (role === 'recepcao') {
    document.getElementById('nav-config-section').style.display = 'none';
    document.getElementById('nav-fatur-section').style.display  = 'none';
  }
  // Garante que admin sempre vê Usuários e Perfis
  if (role === 'admin') {
    const uEl = document.getElementById('nav-usuarios-item');
    const pEl = document.getElementById('nav-perfis-item');
    if (uEl) { uEl.style.display = ''; uEl.removeAttribute('data-perfil-hidden'); }
    if (pEl) { pEl.style.display = ''; pEl.removeAttribute('data-perfil-hidden'); }
  }
  // Aplica permissões de perfil personalizado se existir
  _aplicarPermissoesDePerfil(user);

 // Espaço Conecta: profissional só vê Agendamento de Salas; financeiro (admin) vê tudo
  const navConecta = document.getElementById('nav-conecta-section');
  if (navConecta) {
    const navFech = document.getElementById('nav-conecta-fech');
    if (role === 'prof') {
      if (navFech) navFech.style.display = 'none';
    } else if (role === 'recepcao') {
      if (navFech) navFech.style.display = 'none';
    }
  }
  // Botão Gerenciar Salas: só admin
  setTimeout(() => {
    const btnGerirSalas = document.getElementById('btn-gerir-salas');
    if (btnGerirSalas) btnGerirSalas.style.display = (role === 'admin') ? '' : 'none';
  }, 200);
  // Expõe currentUser globalmente como CURRENT_USER também
  window.CURRENT_USER = currentUser;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('active');

  const btnEl = document.getElementById('btn-login');
  if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Entrar'; }

  initApp();

  // Carrega dados do Supabase após o login (preenche agenda, pacientes, etc.)
  setTimeout(() => {
    if (typeof window.loadFromSupabase === 'function') {
      window.loadFromSupabase();
    }
  }, 100);
}
function doLogout() {
  document.getElementById('app').classList.remove('active');
  document.getElementById('login-screen').style.display = 'flex';
  ['nav-admin-section','nav-config-section','nav-fatur-section'].forEach(id => {
    const el = document.getElementById(id); if(el) el.style.display='';
  });
  // Restaura todos os itens de menu ocultados por perfil
  document.querySelectorAll('.nav-item[data-perfil-hidden]').forEach(el => {
    el.style.display = '';
    el.removeAttribute('data-perfil-hidden');
  });
  // Resetar visibilidade Espaço Conecta
  const navFech = document.getElementById('nav-conecta-fech');
  if (navFech) navFech.style.display = '';
  window.CURRENT_USER = null;
}

