// ─── Toast notification ──────────────────────────────
let _timer;

export function showToast(msg, pos) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.getElementById('app').appendChild(el);
  }
  el.textContent = msg;
  el.style.bottom =
    (pos ?? ((document.getElementById('bottom-bar')?.offsetHeight ?? 62) + 20)) + 'px';
  clearTimeout(_timer);
  el.classList.remove('show');
  // Двойной rAF гарантирует, что браузер успевает снять класс перед добавлением
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.classList.add('show');
    _timer = setTimeout(() => el.classList.remove('show'), 2600);
  }));
}
