// ─── Realtime broadcast subscription (events:klgd) ────
import { supabase } from './supabase.js';
import { state } from './state.js';
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
  // избегаем двойной подписки
  if (state.eventsBroadcastChannel) return;

  const channel = supabase.channel('events:klgd', {
    config: { private: false },
  });

  channel
    .on('broadcast', { event: '*' }, async (payload) => {
      try {
        _reloadEventsDebounced();
      } catch (e) {
        console.error('Events broadcast handling failed', e);
      }
    })
    .subscribe((status, err) => {
      if (err) console.error('Realtime subscribe error:', err);
      else console.log('Realtime subscribe status:', status);
    });

  state.eventsBroadcastChannel = channel;
}