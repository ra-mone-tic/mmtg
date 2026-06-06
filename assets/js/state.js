// ─── Application State (single source of truth) ─────
/**
 * Всё глобальное состояние приложения в одном объекте.
 * Модули импортируют этот объект и мутируют его свойства напрямую,
 * что даёт реактивность без лишних абстракций для проекта такого масштаба.
 */
export const state = {
  // Карта
  map: null,

  // Данные событий
  rawAllEvents   : [],   // сырые объекты из events.json
  events         : [],   // нормализованные события текущей даты
  allEvents      : [],   // нормализованные события (текущая дата, псевдоним)

  // UI
  activeId       : null, // id активного маркера/карточки
  detailId       : null, // id открытого детального экрана
  detailHasImage : true, // есть ли картинка у открытого детального экрана
  panelOpen      : false,
  theme          : 'dark',
  currentDate    : new Date(),

  // Календарь — мультивыбор
  multiSelect    : false,         // включён ли режим мультивыбора
  selectedDates  : [],            // массив строк 'dd.mm.yyyy' (если мультивыбор)

  // Карусель
  carouselScrollPos   : 0,
  carouselVisible     : true,
  carouselLoadedCount : 12,
  carouselObserver    : null,
};
