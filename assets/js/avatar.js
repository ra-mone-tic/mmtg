// ─── Avatar ──────────────────────────────────────────
import { $, TG } from './helpers.js';

export function initAvatar(retry = 5) {
  const btn    = $('btn-avatar');
  const webapp = TG();
  const user   = webapp?.initDataUnsafe?.user;

  if (!btn) return;
  if (!user) {
    if (retry > 0) setTimeout(() => initAvatar(retry - 1), 250);
    return;
  }
  if (!user.photo_url) { setInitials(btn, user); return; }

  const img = new Image();
  img.referrerPolicy = 'no-referrer';
  img.onload  = () => btn.replaceChildren(img);
  img.onerror = () => setInitials(btn, user);
  img.src = `${user.photo_url}${user.photo_url.includes('?') ? '&' : '?'}t=${Date.now()}`;
}

function setInitials(btn, user) {
  const first = user?.first_name?.[0] ?? '';
  const last  = user?.last_name?.[0]  ?? '';
  btn.textContent = (first + last).toUpperCase() || 'U';
}
