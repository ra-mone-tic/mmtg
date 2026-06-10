-- ═══════════════════════════════════════════════════════
-- Triggers & Functions
-- ═══════════════════════════════════════════════════════

-- ─── Auto updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_events_updated_at
    BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_places_updated_at
    BEFORE UPDATE ON places FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Level auto-recalculation ─────────────────────────
CREATE OR REPLACE FUNCTION recalculate_user_level(uid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
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

CREATE OR REPLACE FUNCTION _trigger_level_recalc()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM recalculate_user_level(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_level_favorites
    AFTER INSERT OR DELETE ON favorites
    FOR EACH ROW EXECUTE FUNCTION _trigger_level_recalc();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_level_attendance
    AFTER INSERT OR DELETE ON event_attendance
    FOR EACH ROW EXECUTE FUNCTION _trigger_level_recalc();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_level_follows
    AFTER INSERT OR DELETE ON follows
    FOR EACH ROW EXECUTE FUNCTION _trigger_level_recalc();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Notification on new follower ─────────────────────
CREATE OR REPLACE FUNCTION _notify_new_follower()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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

DO $$ BEGIN
  CREATE TRIGGER trg_notify_follower
    AFTER INSERT ON follows
    FOR EACH ROW EXECUTE FUNCTION _notify_new_follower();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Notification when friend goes to event ───────────
CREATE OR REPLACE FUNCTION _notify_friend_going()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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

DO $$ BEGIN
  CREATE TRIGGER trg_notify_going
    AFTER INSERT ON event_attendance
    FOR EACH ROW EXECUTE FUNCTION _notify_friend_going();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Expire looking_for_company ───────────────────────
CREATE OR REPLACE FUNCTION expire_looking()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted INTEGER;
BEGIN
  DELETE FROM looking_for_company WHERE expires_at < now();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ─── Realtime: enable for social tables ───────────────
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE event_attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE looking_for_company;
