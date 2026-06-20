// external (non-inline) global error reporter — survives strict inline-script CSP
(function(){
  function show(msg){
    var o = document.getElementById('err-overlay');
    if (!o) return;
    o.style.display = 'flex';
    var m = document.getElementById('err-msg');
    if (m) m.textContent = String(msg).slice(0, 600);
  }
  window.addEventListener('error', function(e){
    show((e.message || (e.error && e.error.message) || 'Script error') + (e.filename ? ('\n@ ' + e.filename + ':' + e.lineno) : ''));
  });
  window.addEventListener('unhandledrejection', function(e){
    show('Promise error: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });
})();
