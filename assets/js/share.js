// ─── Share ───────────────────────────────────────────
import { TG } from './helpers.js';
import { CFG } from './config.js';
import { showToast } from './toast.js';

export function buildShareUrl(ev) {
  // Приоритет — нативная ссылка на пост в канале
  if (ev.tg_message_id) {
    const nativeUrl = `https://t.me/meowafisha/${ev.tg_message_id}`;
    const text = encodeURIComponent(
      `${ev.title}\n${ev.date}${ev.time ? ' ' + ev.time : ''}\n${ev.address}`
    );
    return `https://t.me/share/url?url=${encodeURIComponent(nativeUrl)}&text=${text}`;
  }
  const baseUrl = CFG.SHARE_BASE + ev.id;
  const text = encodeURIComponent(
    `${ev.title}\n${ev.date}${ev.time ? ' ' + ev.time : ''}\n${ev.address}`
  );
  return `https://t.me/share/url?url=${encodeURIComponent(baseUrl)}&text=${text}`;
}

export function shareEvent(ev) {
  const webapp   = TG();
  const shareUrl = buildShareUrl(ev);

  const onSuccess = () => {
    webapp?.HapticFeedback?.notificationOccurred('success');
    if (webapp?.showPopup) {
      webapp.showPopup({
        title  : 'Ссылка готова',
        message: `«${ev.title}» — можно отправить в чат`,
        buttons: [{ type: 'ok', text: 'Отлично!' }],
      });
    } else {
      showToast('🔗 Готово к отправке!');
    }
  };

  if (webapp?.openTelegramLink) {
    webapp.openTelegramLink(shareUrl);
    onSuccess();
  } else if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(shareUrl).then(onSuccess).catch(() => _legacyCopy(shareUrl, onSuccess));
  } else {
    _legacyCopy(shareUrl, onSuccess);
  }
}

function _legacyCopy(text, cb) {
  const ta = Object.assign(document.createElement('textarea'), {
    value: text, readOnly: true,
    style: 'position:fixed;left:-9999px;opacity:0',
  });
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); cb(); } catch (_) {}
  ta.remove();
}
