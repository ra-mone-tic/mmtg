-- ═══════════════════════════════════════════════════════
-- MEOW! — Initial Schema Migration
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════

-- ── profiles ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id BIGINT      UNIQUE NOT NULL,
  username    TEXT,
  first_name  TEXT        NOT NULL DEFAULT '',
  last_name   TEXT        DEFAULT '',
  photo_url   TEXT,
  bio         TEXT        DEFAULT '' CHECK (length(bio) <= 300),
  level       TEXT        NOT NULL DEFAULT 'newbie'
                          CHECK (level IN ('newbie','regular','explorer','locals','legend')),
  show_going      BOOLEAN NOT NULL DEFAULT true,
  show_follow     BOOLEAN NOT NULL DEFAULT true,
  looking_for_company BOOLEAN NOT NULL DEFAULT false,
  looking_text    TEXT    DEFAULT '' CHECK (length(looking_text) <= 280),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── events ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                 TEXT        PRIMARY KEY,
  date               TEXT        NOT NULL,
  title              TEXT        NOT NULL,
  location           TEXT        DEFAULT '',
  address            TEXT        DEFAULT '',
  time               TEXT        DEFAULT '',
  tags               TEXT[]      DEFAULT '{}',
  short_description  TEXT        DEFAULT '',
  full_description   TEXT        DEFAULT '',
  description_blocks JSONB       DEFAULT '[]',
  contacts           TEXT        DEFAULT '',
  lat                FLOAT8,
  lon                FLOAT8,
  image_url          TEXT,
  tg_message_id      INTEGER,
  is_active          BOOLEAN     NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_active ON events(is_active, date);

-- ── places ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS places (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  lat         FLOAT8,
  lng         FLOAT8,
  address     TEXT        DEFAULT '',
  description TEXT        DEFAULT '',
  time        TEXT        DEFAULT '',
  image_url   TEXT,
  keywords    TEXT[]      DEFAULT '{}',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── favorites ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id   TEXT        NOT NULL REFERENCES events(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user  ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_event ON favorites(event_id);

-- ── event_attendance (пойду / interested) ─────────────
CREATE TABLE IF NOT EXISTS event_attendance (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id   TEXT        NOT NULL REFERENCES events(id)  ON DELETE CASCADE,
  status     TEXT        NOT NULL DEFAULT 'going'
                         CHECK (status IN ('going','interested')),
  visible    BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_event ON event_attendance(event_id, visible);
CREATE INDEX IF NOT EXISTS idx_attendance_user  ON event_attendance(user_id);

-- ── follows (пользователи и места) ────────────────────
CREATE TABLE IF NOT EXISTS follows (
  follower_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id    TEXT        NOT NULL,  -- UUID юзера или "place-X"
  target_type  TEXT        NOT NULL DEFAULT 'user'
                           CHECK (target_type IN ('user','place')),
  visible      BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, target_id, target_type)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_target   ON follows(target_id, target_type);

-- ── looking_for_company ────────────────────────────────
CREATE TABLE IF NOT EXISTS looking_for_company (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id   TEXT        REFERENCES events(id) ON DELETE CASCADE,
  text       TEXT        DEFAULT '' CHECK (length(text) <= 280),
  visible    BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '48 hours')
);
CREATE INDEX IF NOT EXISTS idx_looking_event  ON looking_for_company(event_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_looking_user   ON looking_for_company(user_id);

-- ── reports ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  type        TEXT        NOT NULL DEFAULT 'bug'
                          CHECK (type IN ('bug','wrong_info','spam','other')),
  target_type TEXT        CHECK (target_type IN ('event','place','user')),
  target_id   TEXT,
  text        TEXT        NOT NULL CHECK (length(text) >= 5 AND length(text) <= 1000),
  status      TEXT        NOT NULL DEFAULT 'new'
                          CHECK (status IN ('new','reviewed','resolved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);

-- ── notifications ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL
                            CHECK (type IN ('favorite_event','friend_going','new_follower',
                                            'friend_request','event_reminder','system','looking')),
  title         TEXT,
  body          TEXT,
  data          JSONB       DEFAULT '{}',
  read          BOOLEAN     NOT NULL DEFAULT false,
  sent_via_bot  BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read, created_at DESC);

-- ── user_levels config ─────────────────────────────────
CREATE TABLE IF NOT EXISTS user_levels (
  level          TEXT    PRIMARY KEY,
  min_favorites  INTEGER NOT NULL DEFAULT 0,
  min_going      INTEGER NOT NULL DEFAULT 0,
  min_friends    INTEGER NOT NULL DEFAULT 0,
  min_days       INTEGER NOT NULL DEFAULT 0,
  badge_emoji    TEXT    NOT NULL DEFAULT '🌱',
  badge_label    TEXT    NOT NULL DEFAULT 'Новичок',
  sort_order     INTEGER NOT NULL DEFAULT 0
);

INSERT INTO user_levels
  (level, min_favorites, min_going, min_friends, min_days, badge_emoji, badge_label, sort_order)
VALUES
  ('newbie',   0,  0,  0,   0,  '🌱', 'Новичок',       0),
  ('regular',  5,  3,  0,   7,  '⭐', 'Постоялец',     1),
  ('explorer', 15, 10, 2,  30,  '🧭', 'Исследователь', 2),
  ('locals',   30, 25, 5,  90,  '🏙️', 'Местный',       3),
  ('legend',   50, 50, 15, 180, '👑', 'Легенда',       4)
ON CONFLICT (level) DO NOTHING;

-- ── admin_roles ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_roles (
  user_id    UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'admin'
                         CHECK (role IN ('admin','super_admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── friends view (mutual follows) ─────────────────────
CREATE OR REPLACE VIEW friends AS
SELECT f1.follower_id AS user_a, f1.following_id AS user_b
FROM (
  SELECT follower_id, target_id::UUID AS following_id
  FROM follows WHERE target_type = 'user' AND visible = true
) f1
INNER JOIN (
  SELECT follower_id, target_id::UUID AS following_id
  FROM follows WHERE target_type = 'user' AND visible = true
) f2 ON f1.follower_id = f2.following_id AND f1.following_id = f2.follower_id;
