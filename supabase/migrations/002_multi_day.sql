-- ═══════════════════════════════════════════════════════
-- MEOW! — Multi-day events support
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════

-- Добавляем колонку для группировки многодневных событий
ALTER TABLE events ADD COLUMN IF NOT EXISTS multi_day_group_id TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_events_multi_day_group ON events(multi_day_group_id);