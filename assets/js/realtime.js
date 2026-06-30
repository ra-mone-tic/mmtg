// ─── Перезагрузка событий при возврате в приложение ───
import { loadAllEvents } from './data.js';

let _reloadTimer = null;
async function _reloadEventsDebounced() {
  if (_reloadTimer) clearTimeout(_reloadTimer);
  _reloadTimer = setTimeout(async () => {
    await loadAllEvents();
    // Триггерим ререндер карты, списка и карусели
    document.dispatchEvent(new CustomEvent('meow:events-changed'));
  }, 500);
}

export function subscribeToEventsBroadcast() {
  // Вместо Realtime (который не работает — pg_notify ≠ Supabase broadcast)
  // перезагружаем события при возврате пользователя в приложение
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      _reloadEventsDebounced();
    }
  });

  // Дополнительно: перезагрузка при переходе на вкладку (для десктопа)
  document.addEventListener('focus', () => {
    _reloadEventsDebounced();
  });
}
