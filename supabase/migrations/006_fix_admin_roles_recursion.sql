-- ═══════════════════════════════════════════════════════
-- Fix: infinite recursion in admin_roles RLS policy
-- The old policy called is_admin() which queries admin_roles,
-- creating a circular dependency.
-- Fix: allow users to read ONLY their own row.
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "admin_roles_read" ON admin_roles;

CREATE POLICY "admin_roles_read" ON admin_roles FOR SELECT
  USING (auth.uid() = user_id);