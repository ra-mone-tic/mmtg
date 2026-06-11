-- ═══════════════════════════════════════════════════════
-- MEOW! — Admin Panel Migration (events CRUD, reports)
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════

-- ── Track who created each event ──────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- ── Auto-update updated_at ────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Triggers (IF NOT EXISTS via CREATE OR REPLACE)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'events_updated_at') THEN
    CREATE TRIGGER events_updated_at
      BEFORE UPDATE ON events
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'places_updated_at') THEN
    CREATE TRIGGER places_updated_at
      BEFORE UPDATE ON places
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ── RPC: get_all_events_admin (includes inactive) ────
CREATE OR REPLACE FUNCTION get_all_events_admin()
RETURNS SETOF events AS $$
  SELECT * FROM events ORDER BY date DESC, created_at DESC;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── RPC: get_reports_summary ──────────────────────────
CREATE OR REPLACE FUNCTION get_reports_summary()
RETURNS TABLE (
  total         BIGINT,
  new_reports   BIGINT,
  reviewed      BIGINT,
  resolved      BIGINT
) AS $$
  SELECT count(*),
    count(*) FILTER (WHERE status = 'new'),
    count(*) FILTER (WHERE status = 'reviewed'),
    count(*) FILTER (WHERE status = 'resolved')
  FROM reports;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── RPC: list all reports for admin ───────────────────
CREATE OR REPLACE FUNCTION get_reports_admin(p_status TEXT DEFAULT NULL)
RETURNS TABLE (
  id          UUID,
  user_id     UUID,
  type        TEXT,
  target_type TEXT,
  target_id   TEXT,
  text        TEXT,
  status      TEXT,
  created_at  TIMESTAMPTZ,
  reporter_name TEXT
) AS $$
  SELECT r.id, r.user_id, r.type, r.target_type, r.target_id, r.text, r.status, r.created_at,
    COALESCE(p.first_name || ' ' || COALESCE(p.last_name,''), 'Anonymous')
  FROM reports r
  LEFT JOIN profiles p ON p.id = r.user_id
  WHERE (p_status IS NULL OR r.status = p_status)
  ORDER BY r.created_at DESC;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── RPC: update report status ─────────────────────────
CREATE OR REPLACE FUNCTION update_report_status(p_report_id UUID, p_status TEXT)
RETURNS VOID AS $$
  UPDATE reports SET status = p_status WHERE id = p_report_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── RPC: promote/demote user ──────────────────────────
CREATE OR REPLACE FUNCTION admin_promote_user(p_user_id UUID, p_role TEXT DEFAULT 'admin')
RETURNS VOID AS $$
  INSERT INTO admin_roles (user_id, role) VALUES (p_user_id, p_role)
  ON CONFLICT (user_id) DO UPDATE SET role = p_role;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_demote_user(p_user_id UUID)
RETURNS VOID AS $$
  DELETE FROM admin_roles WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Index for created_by ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);