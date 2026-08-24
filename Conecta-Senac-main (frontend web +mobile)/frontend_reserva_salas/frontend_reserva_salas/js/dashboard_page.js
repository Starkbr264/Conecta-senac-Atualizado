/*
 * dashboard_page.js
 * Logica do painel publico de disponibilidade de salas (dashboard.html).
 * Exibe a ocupacao atual das salas sem necessidade de login.
 */
window.addEventListener('DOMContentLoaded', function() {


  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Formata data ISO (YYYY-MM-DD) para dd/mm/aaaa */
  function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  /** Exibe mensagem de feedback no formulário */
  function showMsg(el, tipo, texto) {
    el.className = `form-msg ${tipo}`;
    el.textContent = texto;
    el.style.display = 'block';
  }

  /** Toast de notificação temporário */
  function showToast(msg, tipo = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-item ${tipo}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut .3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  /* ============================================================
     Navegação entre seções
     ============================================================ */
  const TOPBAR_META = {
    salas:          { title: 'Salas',          sub: 'Gerencie as salas disponíveis' },
    turmas:         { title: 'Turmas',          sub: 'Gerencie as turmas e cursos' },
    reservas:       { title: 'Reservas',        sub: 'Crie e gerencie reservas recorrentes' },
    disponibilidade:{ title: 'Disponibilidade', sub: 'Verifique a ocupação das salas' },
  };

  function mostrarSecao(secao) {
    document.querySelectorAll('[id^="section-"]').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

    document.getElementById(`section-${secao}`).style.display = 'block';
    document.getElementById(`nav-${secao}`).classList.add('active');

    const meta = TOPBAR_META[secao] || {};
    document.getElementById('topbarTitle').textContent    = meta.title || secao;
    document.getElementById('topbarSubtitle').textContent = meta.sub || '';

    if (secao === 'reservas')        { _popularSelectSalas(); _popularSelectTurmas(); renderTabelaReservas(); }
    if (secao === 'disponibilidade') { refreshDisponibilidade(); }
    if (secao === 'salas')           renderTabelaSalas();
    if (secao === 'turmas')          renderTabelaTurmas();
  }

  /* ============================================================
     Logo — exibe a imagem se src estiver preenchido no HTML,
     caso contrário mostra o texto "SENAC."
     ============================================================ */
  function initLogo() {
    const logoImg  = document.getElementById('logoImg');
    const logoText = document.getElementById('logoText');
    if (logoImg.src && logoImg.getAttribute('src') !== '') {
      logoText.style.display = 'none';
    } else {
      logoImg.style.display = 'none';
    }
  }

  /* ============================================================
     Inicialização da aplicação
     ============================================================ */
  initDados();
  initSalas();
  initTurmas();
  initReservas();
  initDisponibilidade();
  initLogo();
  mostrarSecao('salas');
});
