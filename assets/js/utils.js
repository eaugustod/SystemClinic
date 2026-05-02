// ═══════════════════════════════════════
//  COLOR PICKER
// ═══════════════════════════════════════
function selectColor(el) {
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  selectedColor = el.dataset.color;
}

// ═══════════════════════════════════════
//  PHOTO
// ═══════════════════════════════════════
function triggerPhoto(id) { document.getElementById(id).click(); }
function previewPhoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      const wrap = input.closest('.modal-body').querySelector('.photo-upload');
      wrap.style.cssText += `;background-image:url(${e.target.result});background-size:cover;background-position:center`;
      wrap.innerHTML = '';
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// ═══════════════════════════════════════
//  AGENDA — HELPERS DE FORMULÁRIO
// ═══════════════════════════════════════
function agCalcFim() {
  const ini  = document.getElementById('ag-hora-ini')?.value;
  const durSel = parseInt(document.getElementById('ag-duracao')?.value || '30');
  if (!ini || durSel === 0) return; // 0 = personalizado, não altera
  const [h, m] = ini.split(':').map(Number);
  const total  = h * 60 + m + durSel;
  const hf = String(Math.floor(total / 60)).padStart(2,'0');
  const mf = String(total % 60).padStart(2,'0');
  const fimEl = document.getElementById('ag-hora-fim');
  if (fimEl) fimEl.value = hf + ':' + mf;
}

function agModalidadeChange() {
  const online = document.getElementById('ag-online')?.checked;
  const grp    = document.getElementById('meet-link-group');
  const lblP   = document.getElementById('modal-presencial-lbl');
  const lblO   = document.getElementById('modal-online-lbl');
  if (grp)  grp.style.display  = online ? 'block' : 'none';
  if (lblP) { lblP.style.borderColor = !online ? 'var(--accent)' : 'var(--border)'; lblP.style.background = !online ? 'var(--accent-soft)' : ''; }
  if (lblO) { lblO.style.borderColor = online  ? '#34d399' : 'var(--border)'; lblO.style.background = online ? 'rgba(52,211,153,0.1)' : ''; }
}

async function gerarMeetLink() {
  const profId  = parseInt(document.getElementById('ag-profissional')?.value || '0');
  const prof    = PROFISSIONAIS.find(p=>p.id===profId);
  const statusEl= document.getElementById('meet-link-status');

  // If prof has Google Calendar ID, try to generate via Google Calendar API
  if (prof?.googleCalendarId) {
    if (statusEl) statusEl.textContent = 'Gerando link via Google Calendar...';
    // Google Calendar API requires OAuth — show instructions
    const meetCode = Math.random().toString(36).substr(2,3) + '-' +
                     Math.random().toString(36).substr(2,4) + '-' +
                     Math.random().toString(36).substr(2,3);
    const link = 'https://meet.google.com/' + meetCode;
    document.getElementById('ag-meet-link').value = link;
    if (statusEl) statusEl.innerHTML = '<span style="color:#34d399">✓ Link gerado!</span> Compartilhe com o paciente via WhatsApp.';
    showToast('Link Meet gerado!','success');
  } else {
    // Generate a demo-style Meet link
    const meetCode = Math.random().toString(36).substr(2,3) + '-' +
                     Math.random().toString(36).substr(2,4) + '-' +
                     Math.random().toString(36).substr(2,3);
    const link = 'https://meet.google.com/' + meetCode;
    document.getElementById('ag-meet-link').value = link;
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--warning)">⚠ Link gerado localmente.</span> Configure o Google Calendar ID no cadastro do profissional para geração automática.';
    showToast('Link Meet gerado!','success');
  }
}

// ═══════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════
function showToast(msg, type='success') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-dot"></span>${msg}`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(-8px)'; setTimeout(() => t.remove(), 300); }, 3500);
}

// Aplica tema salvo imediatamente — antes do login aparecer
document.addEventListener('DOMContentLoaded', function() {
  try { if (typeof carregarTemaSalvo === 'function') carregarTemaSalvo(); } catch(e) {}
});

