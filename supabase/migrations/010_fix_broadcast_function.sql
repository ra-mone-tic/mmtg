-- ═══════════════════════════════════════════════════════
-- MEOW! — Fix broadcast function for new Supabase Realtime
--
-- В новых версиях Supabase функция realtime.send() удалена.
-- Заменяем на pg_notify с именем канала 'realtime:public:events:klgd'.
-- ═══════════════════════════════════════════════════════

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