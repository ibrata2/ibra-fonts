/* Bridge to the Windows app (WebView2). In a normal browser window.NATIVE stays null and the page works as a web tool. */
(function () {
  'use strict';
  const wv = window.chrome && window.chrome.webview;
  if (!wv) { window.NATIVE = null; return; }
  let seq = 0;
  const waiting = new Map();
  wv.addEventListener('message', e => {
    const m = e.data; if (!m || typeof m !== 'object' || !m.id) return;
    const w = waiting.get(m.id); if (!w) return;
    waiting.delete(m.id);
    m.ok ? w.resolve(m.result) : w.reject(new Error(m.error || 'خطأ من البرنامج'));
  });
  function call(cmd, args) {
    return new Promise((resolve, reject) => {
      const id = 'c' + (++seq);
      waiting.set(id, {resolve, reject});
      wv.postMessage({id, cmd, args: args || {}});
    });
  }
  // bytes <-> base64 in chunks (fonts can be several MB)
  function toB64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  window.NATIVE = {call, toB64};
  document.documentElement.classList.add('native');
})();
