-- ═══════════════════════════════════════════════════════
-- MEOW! — Fix all Supabase security linter warnings
-- 1. SECURITY DEFINER → security_invoker on friends view
-- 2. SET search_path = public on all functions
-- 3. REVOKE EXECUTE for internal functions
-- 4. Add is_admin() checks to admin RPC functions
-- ═══════════════════════════════════════════════════════

-- ─── 1. Friends view: SECURITY INVOKER ────────────────
-- Fixes: "security_definer_view"
CREATE OR REPLACE VIEW friends WITH (security_invoker = true) AS
SELECT f1.follower_id AS user_a, f1.following_id AS user_b
FROM (
  SELECT follower_id, target_id::UUID AS following_id
  FROM follows WHERE target_type = 'user' AND visible = true
) f1
INNER JOIN (
  SELECT follower_id, target_id::UUID AS following_id
  FROM follows WHERE target_type = 'user' AND visible = true
) f2 ON f1.follower_id = f2.following_id AND f1.following_id = f2.follower_id;


-- ═══════════════════════════════════════════════════════
-- 2. Recreate all functions with SET search_path = public
-- Fixes: "function_search_path_mutable" (14 functions)
-- ═══════════════════════════════════════════════════════

-- ─── is_admin() ───────────────────────────────────────
-- Also fixes: "anon/authenticated_security_definer_function_executable"
-- (REVOKE below)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_roles WHERE user_id = auth.uid()
  );
$$;

-- ─── _set_updated_at() ────────────────────────────────
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── update_updated_at() ──────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── recalculate_user_level(uid UUID) ─────────────────
CREATE OR REPLACE FUNCTION recalculate_user_level(uid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fav_count    INTEGER;
  going_count  INTEGER;
  friend_count INTEGER;
  day_count    INTEGER;
  new_level    TEXT := 'newbie';
  rec          RECORD;
BEGIN
  SELECT COUNT(*) INTO fav_count   FROM favorites        WHERE user_id = uid;
  SELECT COUNT(*) INTO going_count FROM event_attendance WHERE user_id = uid;
  SELECT COUNT(*) INTO friend_count FROM friends
    WHERE user_a = uid OR user_b = uid;
  SELECT COALESCE(EXTRACT(day FROM (now() - created_at))::INTEGER, 0)
    INTO day_count FROM profiles WHERE id = uid;

  FOR rec IN
    SELECT * FROM user_levels ORDER BY sort_order DESC
  LOOP
    IF fav_count   >= rec.min_favorites AND
       going_count >= rec.min_going AND
       friend_count >= rec.min_friends AND
       day_count   >= rec.min_days
    THEN
      new_level := rec.level; EXIT;
    END IF;
  END LOOP;

  UPDATE profiles
  SET level = new_level, updated_at = now()
  WHERE id = uid AND level IS DISTINCT FROM new_level;
END;
$$;

-- ─── _trigger_level_recalc() ──────────────────────────
CREATE OR REPLACE FUNCTION _trigger_level_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM recalculate_user_level(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─── _notify_new_follower() ───────────────────────────
CREATE OR REPLACE FUNCTION _notify_new_follower()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  follower_profile RECORD;
BEGIN
  IF NEW.target_type != 'user' THEN RETURN NEW; END IF;
  SELECT first_name, last_name, username
    INTO follower_profile FROM profiles WHERE id = NEW.follower_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.target_id::UUID,
    'new_follower',
    'Новый подписчик',
    COALESCE(follower_profile.username, follower_profile.first_name, 'Кто-то') || ' подписался на тебя',
    jsonb_build_object('follower_id', NEW.follower_id)
  );
  RETURN NEW;
END;
$$;

-- ─── _notify_friend_going() ───────────────────────────
CREATE OR REPLACE FUNCTION _notify_friend_going()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  goer_profile  RECORD;
  ev_title      TEXT;
  friend_row    RECORD;
BEGIN
  IF NEW.visible = false THEN RETURN NEW; END IF;
  SELECT first_name, username INTO goer_profile FROM profiles WHERE id = NEW.user_id;
  SELECT title INTO ev_title FROM events WHERE id = NEW.event_id;

  FOR friend_row IN
    SELECT CASE WHEN f.user_a = NEW.user_id THEN f.user_b ELSE f.user_a END AS friend_id
    FROM friends f
    WHERE f.user_a = NEW.user_id OR f.user_b = NEW.user_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      friend_row.friend_id,
      'friend_going',
      'Друг идёт на мероприятие',
      COALESCE(goer_profile.username, goer_profile.first_name, 'Друг') || ' идёт на «' || ev_title || '»',
      jsonb_build_object('event_id', NEW.event_id, 'user_id', NEW.user_id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

-- ─── expire_looking() ─────────────────────────────────
CREATE OR REPLACE FUNCTION expire_looking()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted INTEGER;
BEGIN
  DELETE FROM looking_for_company WHERE expires_at < now();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ─── get_all_events_admin() ───────────────────────────
-- Added is_admin() check (client calls this via RPC)
CREATE OR REPLACE FUNCTION get_all_events_admin()
RETURNS SETOF events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  RETURN QUERY
    SELECT * FROM events ORDER BY date DESC, created_at DESC;
END;
$$;

-- ─── get_reports_summary() ────────────────────────────
CREATE OR REPLACE FUNCTION get_reports_summary()
RETURNS TABLE (
  total         BIGINT,
  new_reports   BIGINT,
  reviewed      BIGINT,
  resolved      BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  RETURN QUERY
    SELECT
      count(*),
      count(*) FILTER (WHERE status = 'new'),
      count(*) FILTER (WHERE status = 'reviewed'),
      count(*) FILTER (WHERE status = 'resolved')
    FROM reports;
END;
$$;

-- ─── get_reports_admin(p_status) ──────────────────────
-- Added is_admin() check (client calls this via RPC)
CREATE OR REPLACE FUNCTION get_reports_admin(p_status TEXT DEFAULT NULL)
RETURNS TABLE (
  id            UUID,
  user_id       UUID,
  type          TEXT,
  target_type   TEXT,
  target_id     TEXT,
  text          TEXT,
  status        TEXT,
  created_at    TIMESTAMPTZ,
  reporter_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  RETURN QUERY
    SELECT r.id, r.user_id, r.type, r.target_type, r.target_id,
           r.text, r.status, r.created_at,
           COALESCE(p.first_name || ' ' || COALESCE(p.last_name,''), 'Anonymous')
    FROM reports r
    LEFT JOIN profiles p ON p.id = r.user_id
    WHERE (p_status IS NULL OR r.status = p_status)
    ORDER BY r.created_at DESC;
END;
$$;

-- ─── update_report_status(p_report_id, p_status) ──────
-- Added is_admin() check (client calls this via RPC)
CREATE OR REPLACE FUNCTION update_report_status(p_report_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  UPDATE reports SET status = p_status WHERE id = p_report_id;
END;
$$;

-- ─── admin_promote_user(p_user_id, p_role) ────────────
CREATE OR REPLACE FUNCTION admin_promote_user(p_user_id UUID, p_role TEXT DEFAULT 'admin')
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO admin_roles (user_id, role) VALUES (p_user_id, p_role)
  ON CONFLICT (user_id) DO UPDATE SET role = p_role;
$$;

-- ─── admin_demote_user(p_user_id) ─────────────────────
CREATE OR REPLACE FUNCTION admin_demote_user(p_user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM admin_roles WHERE user_id = p_user_id;
$$;


-- ═══════════════════════════════════════════════════════
-- 3. REVOKE EXECUTE for internal/trigger functions
-- Fixes: "anon/authenticated_security_definer_function_executable"
-- ═══════════════════════════════════════════════════════

-- Trigger functions: not meant to be called via RPC
REVOKE EXECUTE ON FUNCTION _notify_new_follower() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION _notify_friend_going() FROM anon, authenticated;

-- Internal function: called only by triggers
REVOKE EXECUTE ON FUNCTION recalculate_user_level(UUID) FROM anon, authenticated;

-- Cron function: called only by pg_cron / service_role
REVOKE EXECUTE ON FUNCTION expire_looking() FROM anon, authenticated;

-- Utility function: used internally by policies and admin functions
REVOKE EXECUTE ON FUNCTION is_admin() FROM anon, authenticated;

-- Admin functions not called from client
REVOKE EXECUTE ON FUNCTION get_reports_summary() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_promote_user(UUID, TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_demote_user(UUID) FROM anon, authenticated;

-- Admin functions called from client: revoke from anon only
-- (authenticated users need access; is_admin() check inside protects them)
REVOKE EXECUTE ON FUNCTION get_all_events_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION get_reports_admin(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION update_report_status(UUID, TEXT) FROM anon;