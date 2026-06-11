-- ═══════════════════════════════════════════════════════
-- Row Level Security Policies
-- ═══════════════════════════════════════════════════════

-- Enable RLS on all user-data tables
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows            ENABLE ROW LEVEL SECURITY;
ALTER TABLE looking_for_company ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE places             ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_roles        ENABLE ROW LEVEL SECURITY;

-- ─── Helper function: check if current user is admin ──
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_roles WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── profiles ─────────────────────────────────────────
-- Anyone can read profiles (public social app)
DO $$ BEGIN
  CREATE POLICY "profiles_select_all"   ON profiles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Only self can insert/update
DO $$ BEGIN
  CREATE POLICY "profiles_insert_self"  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "profiles_update_self"  ON profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Admins can do anything
DO $$ BEGIN
  CREATE POLICY "profiles_admin"        ON profiles FOR ALL USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── events ───────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "events_select_active"  ON events FOR SELECT USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "events_admin_all"      ON events FOR ALL   USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── places ───────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "places_select_active"  ON places FOR SELECT USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "places_admin_all"      ON places FOR ALL   USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── favorites ────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "fav_select_own"  ON favorites FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "fav_insert_own"  ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "fav_delete_own"  ON favorites FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── event_attendance ─────────────────────────────────
-- Visible entries can be seen by everyone (for "who's going")
DO $$ BEGIN
  CREATE POLICY "att_select_visible" ON event_attendance FOR SELECT
    USING (visible = true OR auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "att_insert_own"  ON event_attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "att_update_own"  ON event_attendance FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "att_delete_own"  ON event_attendance FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── follows ──────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "follow_select_visible" ON follows FOR SELECT
    USING (visible = true OR auth.uid() = follower_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "follow_insert_own"  ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "follow_update_own"  ON follows FOR UPDATE USING (auth.uid() = follower_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "follow_delete_own"  ON follows FOR DELETE USING (auth.uid() = follower_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── looking_for_company ──────────────────────────────
DO $$ BEGIN
  CREATE POLICY "looking_select_visible" ON looking_for_company FOR SELECT
    USING ((visible = true AND expires_at > now()) OR auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "looking_insert_own"  ON looking_for_company FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "looking_update_own"  ON looking_for_company FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "looking_delete_own"  ON looking_for_company FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── reports ──────────────────────────────────────────
-- Authenticated users can submit reports
DO $$ BEGIN
  CREATE POLICY "reports_insert_auth"  ON reports FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Only admins can read/update reports
DO $$ BEGIN
  CREATE POLICY "reports_admin_all"   ON reports FOR ALL USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── notifications ────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "notif_own"  ON notifications FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Edge functions (service role) bypass RLS automatically

-- ─── admin_roles ──────────────────────────────────────
-- Only super_admins and service role can manage admin_roles
DO $$ BEGIN
  CREATE POLICY "admin_roles_read"  ON admin_roles FOR SELECT USING (auth.uid() = user_id OR is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "admin_roles_super" ON admin_roles FOR ALL
    USING (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;