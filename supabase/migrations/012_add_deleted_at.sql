-- ═══════════════════════════════════════════════════════
-- MEOW! — Add soft-delete column to events
-- ═══════════════════════════════════════════════════════

-- 1. Добавляем колонку deleted_at
ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Индекс для быстрого поиска неудалённых событий
CREATE INDEX IF NOT EXISTS idx_events_active_not_deleted
  ON events(is_active, date)
  WHERE deleted_at IS NULL;

-- 3. Обновляем RPC get_all_events_admin — показывать только неудалённые
CREATE OR REPLACE FUNCTION get_all_events_admin()
RETURNS SETOF events AS $$
  SELECT * FROM events
  WHERE deleted_at IS NULL
  ORDER BY date DESC, created_at DESC;
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. Обновляем RPC get_all_events для публичного использования (только активные и неудалённые)
CREATE OR REPLACE FUNCTION get_active_events()
RETURNS SETOF events AS $$
  SELECT * FROM events
  WHERE is_active = true AND deleted_at IS NULL
  ORDER BY date DESC, created_at DESC;
$$ LANGUAGE sql SECURITY DEFINER;