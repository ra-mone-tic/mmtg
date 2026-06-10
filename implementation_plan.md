# Implementation Plan: Supabase Migration for MEOW! Telegram Mini App

## [Overview]

Complete migration of the MEOW! Telegram Mini App from static JSON data to Supabase backend, adding full social interactivity: profiles, favorites, "going/follow/friends", "looking for company", user levels, admin panel, bug reporting, and Telegram bot notifications.

The current application is a single-page vanilla JS app running inside Telegram WebApp with no backend — events and places are loaded from static `events.json` and `places.json` files. User identity comes only from `Telegram.WebApp.initDataUnsafe.user`. This plan introduces Supabase as the complete backend layer (PostgreSQL database, authentication, Row Level Security, Edge Functions for bot integration) and restructures the frontend to support social features while maintaining the existing map-based UX.

This implementation is divided into **5 phases** to manage complexity and allow incremental deployment.

---

## [Types]

### Supabase Database Schema

#### Table: `profiles`
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  photo_url TEXT,
  bio TEXT DEFAULT '',
  level TEXT DEFAULT 'newbie' CHECK (level IN ('newbie', 'regular', 'explorer', 'locals', 'legend')),
  show_going BOOLEAN DEFAULT true,
  show_follow BOOLEAN DEFAULT true,
  looking_for_company BOOLEAN DEFAULT false,
  looking_text TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Table: `events` (synced from JSON via Edge Function)
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,          -- MD5 hash from processor.py
  date TEXT NOT NULL,            -- "dd.mm.yyyy"
  title TEXT NOT NULL,
  location TEXT,
  address TEXT,
  time TEXT,
  tags TEXT[] DEFAULT '{}',
  short_description TEXT,
  full_description TEXT,
  description_blocks JSONB,
  contacts TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  image_url TEXT,
  tg_message_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Table: `places`
```sql
CREATE TABLE places (
  id TEXT PRIMARY KEY,          -- e.g. "place-1"
  name TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  address TEXT,
  description TEXT,
  time TEXT,
  image_url TEXT,
  keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Table: `favorites`
```sql
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, event_id)
);
CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_event ON favorites(event_id);
```

#### Table: `event_attendance` (пойду / attending)
```sql
CREATE TABLE event_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'interested')),
  visible BOOLEAN DEFAULT true,    -- показать/скрыть от других
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, event_id)
);
```

#### Table: `follows`
```sql
CREATE TABLE follows (
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visible BOOLEAN DEFAULT true,    -- показать/скрыть подписку
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);
```

#### Table: `friendships` (взаимный фолоу = дружба)
-- Materialized via view or trigger:
```sql
CREATE VIEW friends AS
SELECT f1.follower_id AS user_a, f1.following_id AS user_b
FROM follows f1
INNER JOIN follows f2
  ON f1.follower_id = f2.following_id
  AND f1.following_id = f2.follower_id
WHERE f1.visible = true AND f2.visible = true;
```

#### Table: `looking_for_company` (ищу компанию)
```sql
CREATE TABLE looking_for_company (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  text TEXT DEFAULT '',
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours')
);
```

#### Table: `messages` (внутренние ЛС)
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (length(text) > 0 AND length(text) <= 1000),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON messages(sender_id, receiver_id, created_at);
```

#### Table: `reports` (сообщить об ошибке)
```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'bug' CHECK (type IN ('bug', 'wrong_info', 'spam', 'other')),
  target_type TEXT CHECK (target_type IN ('event', 'place', 'user')),
  target_id TEXT,
  text TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Table: `notifications` (уведомления)
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT,
  body TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  sent_via_bot BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Table: `user_levels` (configurable level thresholds)
```sql
CREATE TABLE user_levels (
  level TEXT PRIMARY KEY,
  min_favorites INTEGER DEFAULT 0,
  min_going INTEGER DEFAULT 0,
  min_friends INTEGER DEFAULT 0,
  min_days INTEGER DEFAULT 0,
  badge_emoji TEXT DEFAULT '🆕',
  badge_label TEXT DEFAULT 'Новичок'
);
INSERT INTO user_levels VALUES
  ('newbie',  0,  0,  0,  0,  '🆕', 'Новичок'),
  ('regular', 5,  3,  0,  7,  '🌟', 'Постоялец'),
  ('explorer',15, 10, 2,  30,  '🧭', 'Исследователь'),
  ('locals',  30, 25, 5,  90,  '🏙️', 'Местный'),
  ('legend',  50, 50, 15, 180, '👑', 'Легенда');
```

#### Table: `admin_roles` (админка)
```sql
CREATE TABLE admin_roles (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## [Files]

### New Files to Create

#### Frontend — Supabase Client & Auth
- `assets/js/supabase.js` — Supabase client initialization, auth helpers
- `assets/js/auth.js` — Telegram initData verification, sign-in flow, session management

#### Frontend — Social Features
- `assets/js/profile.js` — Profile screen (bio, level, stats, settings)
- `assets/js/favorites.js` — Favorite events management (add/remove, list)
- `assets/js/social.js` — Follow/unfollow, friends list, "who's going" display
- `assets/js/messages.js` — Internal DM system (send/receive/list conversations)
- `assets/js/looking.js` — "Looking for company" feature (post/view/expire)
- `assets/js/notifications-ui.js` — Notifications bell, badge, list
- `assets/js/report.js` — Bug/info report modal
- `assets/js/admin.js` — Admin panel (CRUD events/places, manage users)

#### Frontend — Modals & UI Components
- `assets/js/profile-modal.js` — Full-screen profile modal HTML/CSS
- `assets/js/messages-modal.js` — Chat interface modal
- `assets/js/looking-panel.js` — "Looking for company" panel
- `assets/css/social.css` — Styles for all new social/profile/admin components

#### Backend — Supabase Edge Functions
- `supabase/functions/verify-telegram/index.ts` — Verify Telegram initData, create/find Supabase user
- `supabase/functions/send-notification/index.ts` — Send Telegram bot notification via Bot API
- `supabase/functions/sync-events/index.ts` — Sync events from JSON to Supabase (or triggered by Python parser)
- `supabase/functions/report-bug/index.ts` — Forward report to Telegram admin chat
- `supabase/functions/cron-expire-looking/index.ts` — Expire stale "looking for company" entries

#### Backend — Supabase Configuration
- `supabase/config.toml` — Supabase project config
- `supabase/migrations/001_initial_schema.sql` — Full schema migration
- `supabase/migrations/002_rls_policies.sql` — Row Level Security policies
- `supabase/migrations/003_seed_levels.sql` — Seed user level data
- `supabase/migrations/004_triggers.sql` — Triggers (auto-update level, notifications)

#### Documentation
- `SUPABASE_SETUP.md` — Step-by-step Supabase project setup guide

### Existing Files to Modify

- `index.html` — Add CSS link for `social.css`, add new modals (profile, messages, looking, report, admin)
- `assets/js/meow-core.js` — Import and initialize auth, social, favorites, notifications modules; wire up avatar click → profile
- `assets/js/state.js` — Add new state fields: `user`, `favorites`, `following`, `friends`, `notifications`, `messages`
- `assets/js/data.js` — Replace `fetch('events.json')` with Supabase query; add real-time subscription
- `assets/js/places.js` — Replace `fetch('places.json')` with Supabase query
- `assets/js/avatar.js` — After auth, load profile photo from Supabase profiles table
- `assets/js/detail.js` — Add "favorite" button, "going" button, "who's going" section, "looking for company" button
- `assets/js/card.js` — Add mini favorite/go indicators on event card
- `assets/js/events-list.js` — Show favorite/going badges on list items
- `assets/js/helpers.js` — Add helper for formatting relative time, level badges
- `assets/js/config.js` — Add Supabase URL and anon key constants
- `src/config.py` — Add SUPABASE_URL and SUPABASE_SERVICE_KEY env vars
- `src/processor.py` — After processing events, sync to Supabase via Edge Function or direct API

### Files to Delete or Archive
- `events.json` — Will be replaced by Supabase `events` table (keep as fallback during migration)
- `places.json` — Will be replaced by Supabase `places` table (keep as fallback during migration)

---

## [Functions]

### New Functions

#### `assets/js/supabase.js`
```javascript
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export function getUser()           // returns current Supabase auth user
export function getSession()        // returns current session
export function signOut()           // clears session
```

#### `assets/js/auth.js`
```javascript
export async function initAuth()              // verify Telegram data, sign in to Supabase
export async function ensureProfile(user)     // create/update profile from Telegram data
export function getCurrentUser()              // returns cached profile or fetches from DB
export function isAdmin()                     // check if user has admin role
export function signOutUser()                 // sign out and clear state
```

#### `assets/js/profile.js`
```javascript
export async function loadProfile(userId)              // fetch profile from DB
export async function updateProfile(data)              // update bio, settings, visibility
export async function calculateLevel(userId)           // compute & update user level
export function renderProfile(userId)                  // render full-screen profile modal
export async function loadUserStats(userId)            // count favorites, going, friends
```

#### `assets/js/favorites.js`
```javascript
export async function loadFavorites(userId)            // load user's favorites
export async function toggleFavorite(eventId)          // add/remove from favorites
export async function isFavorited(eventId)             // check if event is favorited
export function renderFavoritesList()                  // render favorites in profile
```

#### `assets/js/social.js`
```javascript
export async function follow(userId, visible)          // follow a user
export async function unfollow(userId)                 // unfollow
export async function loadFollowing(userId)            // list who user follows
export async function loadFollowers(userId)            // list who follows user
export async function loadFriends(userId)              // mutual follows
export async function getEventGoers(eventId)           // who's going to event
export async function isFollowing(userId)              // check follow status
export function renderWhoGoing(eventId)                // show avatars of attendees
```

#### `assets/js/messages.js`
```javascript
export async function loadConversations(userId)        // list recent conversations
export async function loadMessages(userId, otherId)    // load message history
export async function sendMessage(receiverId, text)    // send DM
export async function markRead(conversationId)         // mark messages as read
export async function getUnreadCount()                 // count unread messages
export function renderConversation(userId, otherId)    // render chat UI
export function renderConversationsList()              // render inbox
```

#### `assets/js/looking.js`
```javascript
export async function postLooking(eventId, text)       // post "looking for company"
export async function cancelLooking()                  // cancel active post
export async function getLookingForCompany(eventId)    // list who's looking
export async function getActiveLooking()               // user's active looking post
export function renderLookingPanel(eventId)            // UI panel
```

#### `assets/js/notifications-ui.js`
```javascript
export async function loadNotifications(userId)        // fetch recent notifications
export async function markNotificationRead(id)         // mark as read
export async function getUnreadCount()                 // badge count
export function renderNotificationsList()              // render dropdown/panel
export function bindRealtimeNotifications()            // subscribe to new notifications
```

#### `assets/js/report.js`
```javascript
export async function submitReport(type, targetType, targetId, text)  // submit report
export function renderReportModal(targetType, targetId)              // show report form
```

#### `assets/js/admin.js`
```javascript
export async function loadAdminData()                 // load events, places, users
export async function createEvent(data)               // add new event
export async function updateEvent(id, data)           // edit event
export async function deleteEvent(id)                 // remove event
export async function createPlace(data)               // add new place
export async function updatePlace(id, data)           // edit place
export async function deletePlace(id)                 // remove place
export async function manageUsers()                   // list/ban/promote users
export function renderAdminPanel()                    // admin dashboard UI
```

### Modified Functions

#### `assets/js/meow-core.js` — `boot()`
- Add `await initAuth()` before data loading
- Add `await ensureProfile(user)` after auth
- Wire `btn-avatar` click → open profile modal instead of showPopup
- Initialize favorites, social, notifications modules
- Subscribe to realtime updates

#### `assets/js/data.js` — `loadAllEvents()`
- Replace `fetch('events.json')` with Supabase query:
  ```javascript
  const { data } = await supabase.from('events').select('*');
  ```
- Add fallback to local `events.json` if Supabase unreachable
- Add realtime subscription for event updates

#### `assets/js/places.js` — `loadPlaces()`
- Replace `fetch('places.json')` with Supabase query
- Add fallback to local `places.json`

#### `assets/js/detail.js` — `openDetail(id)`
- Add favorite button (heart icon) to detail modal
- Add "going" button to detail modal
- Show "who's going" section
- Add "looking for company" panel
- Add "report" button
- Add "message" button if user has friends

#### `assets/js/avatar.js` — `initAvatar()`
- After loading user, also fetch profile from Supabase for custom photo/bio
- Add unread badge for notifications

### Edge Functions

#### `supabase/functions/verify-telegram/index.ts`
- Validates `Telegram.WebApp.initData` using HMAC-SHA256
- Creates auth.users entry or finds existing by telegram_id
- Returns JWT session token
- Called on app boot from `auth.js`

#### `supabase/functions/send-notification/index.ts`
- Accepts: user_id, type, title, body, data
- Creates notification record in DB
- Sends push via Telegram Bot API (`sendMessage`)
- Used for: "User X is going to event Y", "New message", etc.

#### `supabase/functions/sync-events/index.ts`
- Accepts events array (from Python parser output)
- Upserts into `events` table
- Can be called via HTTP webhook or Supabase Storage trigger

#### `supabase/functions/report-bug/index.ts`
- Accepts report data
- Inserts into `reports` table
- Forwards to Telegram admin chat via Bot API

---

## [Classes]

No class-based architecture — the project uses vanilla JS modules. All new code follows the existing ES module pattern with exported functions and shared state.

---

## [Dependencies]

### New NPM / CDN Dependencies

#### Frontend
- `@supabase/supabase-js@2` — Supabase JavaScript client (CDN via unpkg/jsdelivr)
  - Add to `index.html` as: `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>`

#### Backend (Supabase project)
- Supabase CLI (`npx supabase`) — for local development, migrations, Edge Functions
- Deno runtime (comes with Supabase Edge Functions)
- Node.js 18+ (for running Supabase CLI locally)

### Environment Variables

#### Supabase Dashboard
```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_ADMIN_CHAT_ID=<admin-chat-id>
```

#### Frontend (embedded in config.js or loaded at runtime)
```javascript
export const SUPABASE_CONFIG = {
  URL: 'https://<project-ref>.supabase.co',
  ANON_KEY: '<anon-key>',
};
```

---

## [Testing]

### Manual Testing Strategy
1. **Auth flow**: Open in Telegram → verify profile created in Supabase dashboard
2. **Favorites**: Add/remove event from favorites → verify in profile
3. **Going**: Toggle "going" on event → verify visible on event detail to other users
4. **Follow/Friends**: Follow another user → verify mutual = friend → verify friend badge
5. **Looking for company**: Post on event → verify visible to others → verify expiry after 24h
6. **Messages**: Send DM → verify delivery → verify read receipts
7. **Notifications**: Trigger event → verify Telegram bot notification arrives
8. **Reports**: Submit bug report → verify in admin chat
9. **Admin panel**: CRUD event/place → verify appears on map
10. **RLS**: Attempt unauthorized data access → verify blocked
11. **Offline fallback**: Disable network → verify events load from local JSON
12. **Level system**: Accumulate actions → verify level auto-upgrades

### Automated Testing (future)
- Unit tests for auth helpers, level calculation
- Integration tests for Supabase queries
- RLS policy tests via `supabase db test`

---

## [Implementation Order]

### Phase 1: Foundation (Supabase Setup + Auth + Data Migration)
1. Create Supabase project at supabase.com
2. Run `npx supabase init` in project root
3. Create SQL migration for all tables (profiles, events, places)
4. Implement RLS policies for basic read/write
5. Create Edge Function `verify-telegram`
6. Create `assets/js/supabase.js` — client initialization
7. Create `assets/js/auth.js` — Telegram verification + sign-in
8. Modify `assets/js/config.js` — add Supabase config constants
9. Modify `assets/js/state.js` — add user/auth state
10. Modify `assets/js/meow-core.js` — call `initAuth()` at boot
11. Create `assets/js/data.js` modification — query Supabase instead of JSON fetch
12. Create `assets/js/places.js` modification — query Supabase instead of JSON fetch
13. Sync events.json → Supabase events table (one-time migration script)
14. Sync places.json → Supabase places table (one-time migration script)
15. Test: app loads events/places from Supabase, auth works

### Phase 2: User Profile + Favorites
16. Create SQL migration for `favorites` table + RLS
17. Create `assets/js/favorites.js` — toggle, list, check
18. Create `assets/js/profile.js` — load/update profile
19. Create `assets/css/social.css` — profile/favorite styles
20. Create profile modal HTML in `index.html`
21. Modify `assets/js/detail.js` — add favorite button
22. Modify `assets/js/card.js` — add favorite indicator
23. Modify `assets/js/avatar.js` — click opens profile
24. Modify `assets/js/meow-core.js` — wire profile + favorites
25. Test: favorites persist across sessions, profile editable

### Phase 3: Social Features (Going, Follow, Friends, Looking)
26. Create SQL migration for `event_attendance` + `follows` + `looking_for_company` + `messages` tables
27. Create `assets/js/social.js` — follow, unfollow, who's going
28. Create `assets/js/looking.js` — post/view looking for company
29. Create `assets/js/messages.js` — DM system
30. Create `assets/css/social.css` extensions
31. Create messages modal + looking panel HTML in `index.html`
32. Modify `assets/js/detail.js` — add going button, who's going, looking panel, message button
33. Modify `assets/js/events-list.js` — show going/favorite badges
34. Create Edge Function `send-notification` — Telegram bot notifications
35. Create `assets/js/notifications-ui.js` — bell + notification list
36. Test: full social flow works

### Phase 4: Admin + Reports + Notifications
37. Create SQL migration for `reports` + `admin_roles` + `notifications` tables
38. Create `assets/js/report.js` — report modal
39. Create `assets/js/admin.js` — admin panel CRUD
40. Create `assets/js/notifications-ui.js` — full implementation
41. Create Edge Function `report-bug` — forward to admin chat
42. Modify `assets/js/detail.js` — add report button
43. Create admin panel HTML in `index.html`
44. Modify `assets/js/meow-core.js` — wire admin, reports, notifications
45. Test: admin can CRUD, reports reach admin chat

### Phase 5: Level System + Polish
46. Create SQL migration for `user_levels` + auto-update trigger
47. Implement level calculation in `assets/js/profile.js`
48. Add level badges to profile, messages, who's going
49. Create Edge Function `cron-expire-looking`
50. Add realtime subscriptions for live updates (who's going, looking)
51. Add offline fallback: if Supabase unreachable, load from local JSON
52. Security audit: verify all RLS policies, rate limiting
53. Performance: add indexes, optimize queries
54. Final testing: all features end-to-end

---

## Security Considerations

1. **Telegram initData verification**: Every auth request must verify HMAC signature using bot token
2. **RLS policies**: All tables have Row Level Security enabled — users can only read/write their own data (except public event/place data)
3. **Anon key**: Frontend only uses `SUPABASE_ANON_KEY` (never service role key)
4. **Edge Functions**: Use `SUPABASE_SERVICE_ROLE_KEY` only server-side
5. **Rate limiting**: Edge Functions implement rate limits to prevent abuse
6. **Input validation**: All user text inputs validated (length, content) at database level via CHECK constraints
7. **Admin authorization**: Checked via `admin_roles` table + RLS policy before any admin operation
8. **Message privacy**: Messages only visible to sender and receiver via RLS
9. **Follow visibility**: Users control `visible` flag on follows
10. **Report integrity**: Reports are append-only, only admins can change status