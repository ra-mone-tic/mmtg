// ─── Report — submit bug/info reports ─────────────────
import { $ } from './helpers.js';
import { state } from './state.js';
import { supabase, callEdge } from './supabase.js';
import { isAuthed } from './auth.js';
import { showToast } from './toast.js';

/**
 * Opens the report modal for a given target.
 * @param {'event'|'place'|'user'} targetType
 * @param {string} targetId
 * @param {string} [targetName] — display name for the report header
 */
export function openReport(targetType, targetId, targetName = '') {
  const modal = $('report-modal');
  if (!modal) return;

  modal.dataset.targetType = targetType;
  modal.dataset.targetId   = targetId;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  const body = modal.querySelector('.report-body');
  if (body) {
    body.innerHTML = `
      <h3 class="report-title">Сообщить об ошибке</h3>
      <p class="report-subtitle">Тип: ${_typeLabel(targetType)}${targetName ? ' · ' + _esc(targetName) : ''}</p>
      <div class="report-types">
        <button class="report-type-btn active" data-type="bug">🐛 Баг</button>
        <button class="report-type-btn" data-type="wrong_info">📋 Неверная инфо</button>
        <button class="report-type-btn" data-type="spam">🚫 Спам</button>
        <button class="report-type-btn" data-type="other">💬 Другое</button>
      </div>
      <textarea class="report-text-input" id="report-text" maxlength="1000"
                placeholder="Опишите проблему (минимум 5 символов)…"></textarea>
      <div class="report-actions">
        <button class="report-btn-cancel" id="report-cancel">Отмена</button>
        <button class="report-btn-submit" id="report-submit">Отправить</button>
      </div>
    `;

    // Type selection
    let selectedType = 'bug';
    body.querySelectorAll('.report-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        body.querySelectorAll('.report-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedType = btn.dataset.type;
      });
    });

    // Cancel
    body.querySelector('#report-cancel')?.addEventListener('click', closeReport);

    // Submit
    body.querySelector('#report-submit')?.addEventListener('click', async () => {
      const text = body.querySelector('#report-text')?.value.trim() || '';
      if (text.length < 5) { showToast('Минимум 5 символов'); return; }

      const btn = body.querySelector('#report-submit');
      btn.textContent = 'Отправка…';
      btn.disabled = true;

      try {
        // Try edge function first, fall back to direct Supabase
        try {
          await callEdge('report-bug', {
            type: selectedType,
            target_type: targetType,
            target_id:   targetId,
            text,
          });
        } catch (_) {
          await supabase.from('reports').insert({
            user_id:     state.user?.id ?? null,
            type:        selectedType,
            target_type: targetType,
            target_id:   targetId,
            text,
          });
        }
        showToast('✅ Спасибо! Сообщение отправлено');
        closeReport();
      } catch (err) {
        console.error('[MEOW] report submit error:', err);
        showToast('Ошибка отправки');
        btn.textContent = 'Отправить';
        btn.disabled = false;
      }
    });
  }
}

export function closeReport() {
  const modal = $('report-modal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

// ── Helpers ────────────────────────────────────────────

function _typeLabel(type) {
  return { event: 'Мероприятие', place: 'Место', user: 'Пользователь' }[type] ?? type;
}

const _ESC = { '&': 'amp;', '<': 'lt;', '>': 'gt;', '"': 'quot;', "'": '#39;' };
function _esc(s) { return String(s || '').replace(/[&<>"']/g, ch => _ESC[ch]); }