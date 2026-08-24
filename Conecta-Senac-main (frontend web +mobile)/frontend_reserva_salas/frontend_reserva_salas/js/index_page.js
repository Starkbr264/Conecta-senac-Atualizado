/*
 * index_page.js
 * Logica da pagina inicial (landing page / sobre o sistema).
 * Controla o botao de alternancia de tema claro/escuro.
 */
window.addEventListener('DOMContentLoaded', function() {
  initTema();

  function atualizarIconeTema() {
    var t = getTema();
    document.getElementById('btnTema').innerHTML = t === 'dark' ? '<i class="ph ph-sun"></i>' : '<i class="ph ph-moon"></i>';
  }

  var _origToggle = toggleTema;
  toggleTema = function() { _origToggle(); atualizarIconeTema(); };
  atualizarIconeTema();
});
