// ─── Application State (single source of truth) ─────
export const state = {
  // Карта
  map: null,

  // Данные событий
  rawAllEvents   : [],
  events         : [],
  allEvents      : [],

  // UI
  activeId            : null,
  detailId            : null,
  detailHasImage      : true,
  placeDetailHasImage : true,
  panelOpen           : false,
  theme               : 'dark',
  currentDate         : new Date(),

  // Календарь — мультивыбор
  multiSelect    : false,
  selectedDates  : [],

  // Места
  activePlaceId       : null,
  panelMode           : 'events',
  rawPlaces           : [],

  // Карусель
  carouselScrollPos   : 0,
  carouselVisible     : true,
  carouselLoadedCount : 12,
  carouselObserver    : null,

  // Поисковые чипсы
  searchChips         : [],

  // ── Auth / User ──────────────────────────────────────
  /**
   * Профиль текущего пользователя (из Supabase profiles table).
   * null = не авторизован или авторизация не завершена.
   */
  user: null,
  /*  {
        id: 'uuid',
        telegram_id: 123456,
        username: 'user',
        first_name: 'Иван',
        last_name: 'Иванов',
        photo_url: null,
        bio: '',
        level: 'newbie',
        show_going: true,
        show_follow: true,
        looking_for_company: false,
        looking_text: '',
        is_admin: false,
      }
  */

  // ── Social ───────────────────────────────────────────
  /** Set<eventId> — избранные мероприятия */
  favoritedIds: new Set(),

  /** Set<eventId> — мероприятия, на которые пользователь "идёт" */
  goingIds: new Set(),

  /** Map<eventId, Array<profile>> — кто ещё идёт на мероприятие */
  goersCache: new Map(),

  /** Set<targetId> — пользователи/места в подписке */
  followingIds: new Set(),

  // ── Notifications ─────────────────────────────────────
  /** Количество непрочитанных уведомлений */
  unreadNotifCount: 0,

  // ── Data source ──────────────────────────────────────
  /** true если данные загружены из Supabase, false = из локального JSON */
  usingSupabase: false,
};
