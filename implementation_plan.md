# Implementation Plan

Исправление и доработка парсера Telegram-канала @meowafisha: корректный парсинг времени (включая разделитель-точку и диапазоны), поддержка многодневных мероприятий (создание отдельных событий на каждую дату), стабильная сортировка events.json по ISO-дате, извлечение thumbnail из видео-афиш.

Необходимо решить 4 ключевые проблемы: (1) парсер не находит время, записанное через точку ("19.00") и не обрабатывает диапазоны ("17:00-23:00"); (2) многодневные мероприятия (фестивали, спектакли в разные даты) парсятся как одно событие с первой датой; (3) events.json при каждой генерации пересортировывается из-за строковой сортировки DD.MM.YYYY, создавая огромные diff'ы; (4) видео-афиши полностью игнорируются. Решение затрагивает только Python-бэкенд — парсер, процессор, скрипт генерации JSON. Фронтенд не меняется.

[Types]

Не требуется новых типов данных. Добавляется одно временное поле `is_thumbnail` для служебного использования (не сохраняется в Supabase). Во всех типах event'ов поле `time` теперь будет либо пустым, либо содержать одно значение "ЧЧ:ММ", при этом диапазоны времени не сохраняются (извлекаются только для определения начала).

[Files]

Изменяются 4 файла, 1 создаётся новый:

**Новый файл:**
- `scripts/cleanup_images.py` — скрипт для очистки thumbnail (превью видео) старше 7 дней. Работает по аналогии с existing Edge Function `cleanup-old-images` на Supabase, но для локально сохранённых thumbnail в папке images/.

**Изменяемые файлы:**
1. `src/parser.py` (существующий) — расширение регулярных выражений для поиска времени с точкой, плюс функция извлечения нескольких дат из текста поста
2. `src/processor.py` (существующий) — обработка видео-афиш (thumbnail), вызов новой логики split_multi_day_event
3. `scripts/generate_events_json.py` (существующий) — сортировка по ISO-дате + стабильный второстепенный ключ
4. `src/telegram_api.py` (существующий) — добавить функцию `get_thumbnail_url` для видео

[Functions]

**Новые функции:**

1. `parse_time_from_text(text: str) -> str` (в `src/parser.py`)
   - Сигнатура: `def parse_time_from_text(text: str) -> str`
   - Назначение: ищет время во всём тексте поста, включая варианты с точкой ("в 19.00", "в 21.00", "19.00 - 23.00", "18.00-23:00", "11.00"), также ищет с двоеточием ("19:00", "в 19:00")
   - Возвращает строку "ЧЧ:ММ" (нормализованную) или ""

2. `extract_dates_fallback(text: str, first_date: str) -> list[dict]` (в `src/parser.py`)
   - Сигнатура: `def extract_dates_fallback(text: str, first_date: str) -> list[dict]`
   - Назначение: извлекает из текста поста дополнительные даты (в формате "DD.MM" или "DD.MM.YYYY"), а также диапазоны "DD.MM-DD.MM", и возвращает список словарей {date: str, time: str} с теми же title/location/address
   - Возвращает пустой список, если других дат нет
   - Учитывает разделители: "—", "-", "–"

3. `get_thumbnail_url(msg: dict) -> Optional[str]` (в `src/telegram_api.py`)
   - Сигнатура: `def get_thumbnail_url(msg: dict) -> Optional[str]`
   - Назначение: если у сообщения есть video или animation, получает thumbnail (через file_id из `msg["video"]["thumbnail"]` или `msg["video"]["thumb"]`) и возвращает URL для скачивания
   - Аналогично `get_file_url`

4. `cleanup_old_thumbnails(days: int = 7)` (в `scripts/cleanup_images.py`)
   - Сигнатура: `def cleanup_old_thumbnails(days: int = 7) -> int`
   - Назначение: удаляет из папки images/ файлы thumbnail (с префиксом thumb_ или флагом), которые старше N дней
   - Возвращает количество удалённых файлов

**Изменяемые функции:**

1. `parse_post()` в `src/parser.py`:
   - Заменить блок поиска времени (строки 68-77) на вызов `parse_time_from_text(text)`
   - После нахождения даты в первой строке — вызвать `extract_dates_fallback()` для поиска дополнительных дат
   - В возвращаемое значение добавить поле `extra_dates: list[str]` (список дополнительных дат в формате "DD.MM.YYYY")

2. `process_single_message()` в `src/processor.py`:
   - После `_build_event_dict()` вызвать `_attach_image()` для фото, и новую функцию `_attach_thumbnail()` для видео
   - Если `parsed` содержит `extra_dates`, создать по событию на каждую дополнительную дату и добавить через `_upsert`

3. `process_media_group()` в `src/processor.py`:
   - Аналогично: если есть видео с thumbnail, скачать и загрузить thumbnail, сохранить с флагом `is_thumbnail`
   - Если есть `extra_dates` — создать отдельные события

4. `process_messages()` в `src/processor.py`:
   - После обработки всех сообщений, для каждого события с `extra_dates` создать копии с другими датами (поле `date` меняется, `id` пересчитывается через `make_event_id`)

5. `generate_events_json.py`:
   - Заменить сортировку: вместо `order=date.asc` в SQL-запросе, сортировать в Python после выгрузки:
     ```python
     from datetime import datetime
     def sort_key(e):
         try:
             d = datetime.strptime(e.get("date", ""), "%d.%m.%Y")
             return (d.isoformat(), e.get("title", ""))
         except:
             return ("9999-99-99", e.get("title", ""))
     output.sort(key=sort_key)
     ```

[Classes]

Изменений классов не требуется.

[Dependencies]

Новых зависимостей не требуется. Все используемые библиотеки (re, hashlib, json, datetime, pathlib, tempfile, urllib) уже есть в requirements.txt или являются стандартными.

[Testing]

Ручное тестирование на существующих данных. Проверить:
1. Что время "в 19.00" парсится как "19:00"
2. Что "в 21.00" тоже парсится как "21:00"
3. Что диапазон "17:00-23:00" извлекает "17:00" (только начало)
4. Что фестиваль "БАШНЯ" с пятью датами создаёт 5 отдельных событий
5. Что events.json после generate_events_json.py сортируется стабильно: сначала по дате (ISO), потом по title
6. Что thumbnail из видео сохраняется и имеет корректный URL

Для автоматизации: запустить парсер на тестовом наборе (export из Supabase или локальный JSON).

[Implementation Order]

Изменения в порядке зависимости: сначала парсер (время + даты), потом процессор (multiday + thumbnail), затем скрипт генерации (сортировка), и наконец cleanup-скрипт.

1. **Парсер времени** — расширить `parse_post()` в `src/parser.py`: добавить `parse_time_from_text` (поддержка точки), оставить старую логику как fallback
2. **Парсер дат** — добавить `extract_dates_fallback` в `src/parser.py`, интегрировать в `parse_post()`
3. **Thumbnail для видео** — добавить `get_thumbnail_url()` в `src/telegram_api.py`, и `_attach_thumbnail()` в `src/processor.py`
4. **Multi-day events** — модифицировать `process_messages()` в `src/processor.py`: после `_upsert` основного события создать копии для extra_dates
5. **Сортировка events.json** — исправить `scripts/generate_events_json.py`: заменить сортировку на ISO-дату + title
6. **Скрипт очистки thumbnail** — создать `scripts/cleanup_images.py`