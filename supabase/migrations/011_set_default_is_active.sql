-- ═══════════════════════════════════════════════════════
-- MEOW! — Set default value for events.is_active
--
-- Новые мероприятия из Telegram теперь автоматически получат
-- is_active = true, что позволит им отображаться в ленте
-- без ручной активации.
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.events
  ALTER COLUMN is_active SET DEFAULT true;