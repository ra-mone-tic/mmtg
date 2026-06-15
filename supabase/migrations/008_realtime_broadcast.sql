-- ═══════════════════════════════════════════════════════
-- MEOW! — Realtime broadcast triggers for all UI tables
--
-- При любом INSERT/UPDATE/DELETE на указанных таблицах
-- шлём broadcast-сообщение в канал realtime:public:events:klgd.
-- Клиент (assets/js/realtime.js) подписан на этот канал
-- и перезагружает события с debounce 500ms.
-- ═══════════════════════════════════════════════════════

-- ── Broadcast function ─────────────────────────────────
-- Отправляет broadcast-событие в канал events:klgd
-- с информацией об операции и затронутой таблице.
-- Использует pg_notify (совместимо с новой версией Supabase Realtime).
CREATE OR REPLACE FUNCTION public.broadcast_events_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_notify(
    'realtime:public:events:klgd',
    jsonb_build_object(
      'op',    TG_OP,
      'table', TG_TABLE_NAME
    )::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── Events ────────────────────────────────────────────
-- (триггер на INSERT/UPDATE/DELETE — напрямую в админке)
DO $$ BEGIN
  CREATE TRIGGER trg_events_broadcast
    AFTER INSERT OR UPDATE OR DELETE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.broadcast_events_changed();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Favorites (лайки / сердечки) ──────────────────────
DO $$ BEGIN
  CREATE TRIGGER trg_favorites_broadcast
    AFTER INSERT OR UPDATE OR DELETE ON public.favorites
    FOR EACH ROW EXECUTE FUNCTION public.broadcast_events_changed();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Event Attendance (я иду / интересно) ──────────────
DO $$ BEGIN
  CREATE TRIGGER trg_event_attendance_broadcast
    AFTER INSERT OR UPDATE OR DELETE ON public.event_attendance
    FOR EACH ROW EXECUTE FUNCTION public.broadcast_events_changed();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Looking For Company (ищу компанию) ────────────────
DO $$ BEGIN
  CREATE TRIGGER trg_looking_for_company_broadcast
    AFTER INSERT OR UPDATE OR DELETE ON public.looking_for_company
    FOR EACH ROW EXECUTE FUNCTION public.broadcast_events_changed();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Reports (репорты) ─────────────────────────────────
DO $$ BEGIN
  CREATE TRIGGER trg_reports_broadcast
    AFTER INSERT OR UPDATE OR DELETE ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.broadcast_events_changed();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Follows (подписки на пользователей и места) ───────
DO $$ BEGIN
  CREATE TRIGGER trg_follows_broadcast
    AFTER INSERT OR UPDATE OR DELETE ON public.follows
    FOR EACH ROW EXECUTE FUNCTION public.broadcast_events_changed();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Profiles (уровень, статус looking, аватарка) ──────
-- Срабатывает только на UPDATE (при старте профиль уже загружен).
DO $$ BEGIN
  CREATE TRIGGER trg_profiles_broadcast
    AFTER UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.broadcast_events_changed();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Notifications (непрочитанные уведомления) ─────────
DO $$ BEGIN
  CREATE TRIGGER trg_notifications_broadcast
    AFTER INSERT OR UPDATE OR DELETE ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.broadcast_events_changed();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;