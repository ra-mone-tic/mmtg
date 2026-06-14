-- ═══════════════════════════════════════════════════════
-- MEOW! — Tags table & Storage bucket for event images
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════

-- ── tags ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Enable Row Level Security
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- Anyone can read tags
DO $$ BEGIN
  CREATE POLICY "Anyone can read tags"
    ON tags FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only admins can insert/update/delete tags
DO $$ BEGIN
  CREATE POLICY "Admins can insert tags"
    ON tags FOR INSERT
    WITH CHECK (
      EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update tags"
    ON tags FOR UPDATE
    USING (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete tags"
    ON tags FOR DELETE
    USING (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Storage bucket for event images ─────────────────────
-- Create the bucket (run separately if the bucket already exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images',
  'event-images',
  true,
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to event-images
DO $$ BEGIN
  CREATE POLICY "Public can read event images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'event-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Allow admins to upload images
DO $$ BEGIN
  CREATE POLICY "Admins can upload event images"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'event-images'
      AND EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Allow admins to update images
DO $$ BEGIN
  CREATE POLICY "Admins can update event images"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'event-images'
      AND EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Allow admins to delete images
DO $$ BEGIN
  CREATE POLICY "Admins can delete event images"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'event-images'
      AND EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;