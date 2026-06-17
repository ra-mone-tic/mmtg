"""
MeowAfisha · src/parser.py
Парсинг текста поста в структуру события.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import List, Optional

from .config import KLGD_CITIES

logger = logging.getLogger(__name__)


def parse_post(
    text: str,
    entities: Optional[List[dict]] = None,
) -> Optional[dict]:
    """
    Парсит текст поста формата:
        30.05 | Название
        Описание...
        📍Адрес

    entities — список Telegram-entities (для извлечения гиперссылок).
    Возвращает словарь или None, если пост не подходит под формат.
    """
    if not text or not text.strip():
        return None

    # ── Разбиваем текст на параграфы, сохраняя структуру ───
    # Параграфы отделяются пустой строкой. Внутри параграфа —
    # обычные переносы строк (стих / список / перенос фразы).
    raw_blocks = re.split(r"\n\s*\n", text.strip())
    blocks: List[List[str]] = []
    for b in raw_blocks:
        lines = [ln.strip() for ln in b.split("\n") if ln.strip()]
        if lines:
            blocks.append(lines)
    if not blocks:
        return None
    first_lines = blocks[0]
    if not first_lines:
        return None

    # ── Дата и заголовок ────────────────────────────
    first_line = first_lines[0]

    # Проверяем на диапазон дат в первой строке: "DD.MM - DD.MM | Title" → берём первую дату
    m_range = re.match(
        r"(\d{1,2})\.(\d{1,2})\s*[-–—]\s*\d{1,2}\.\d{1,2}\s*[|–—\-]\s*(.+)$",
        first_line,
    )
    if m_range:
        day, month = int(m_range.group(1)), int(m_range.group(2))
        hour, minute = None, None
        title = m_range.group(3).strip()
    else:
        m = re.search(
            r"(\d{1,2})\.(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?\s*[|–—\-]\s*(.+)$",
            first_line,
        )
        if not m:
            logger.debug(f"Не удалось распарсить первую строку: {first_line!r}")
            return None

        day, month = int(m.group(1)), int(m.group(2))
        hour, minute = m.group(3), m.group(4)
        title = m.group(5).strip()

    now  = datetime.now()
    year = now.year
    if datetime(year, month, day) < now - timedelta(days=30):
        year += 1
    date_str = f"{day:02d}.{month:02d}.{year}"

    # ── Время ────────────────────────────────────────
    if hour is not None and minute is not None:
        time_str = f"{int(hour):02d}:{int(minute):02d}"
    else:
        # Ищем время в тексте, исключая первую строку (там дата, а не время)
        text_without_first_line = "\n".join(text.strip().split("\n")[1:])
        time_str = _parse_time_from_text(text_without_first_line)

    # ── Адрес ────────────────────────────────────────
    addr_m = re.search(r"📍\s*(.+)", text)
    if not addr_m:
        logger.debug(f"Нет адреса (📍) в посте: {title!r}")
        return None
    address = addr_m.group(1).strip().rstrip(".")

    # ── Описание ─────────────────────────────────────
    # Сохраняем структуру параграфов: пропускаем первый блок (там заголовок),
    # а также блоки/строки, начинающиеся с маркеров адреса/ссылки/тегов.
    description_blocks: List[List[str]] = []
    for blk in blocks[1:]:
        clean_lines: List[str] = []
        for line in blk:
            if line.startswith("📍") or line.startswith("➡️") or line.startswith("#"):
                break
            clean_lines.append(line)
        if clean_lines:
            description_blocks.append(clean_lines)

    # Для обратной совместимости — плоская строка, где параграфы разделены \n\n.
    full_description = "\n\n".join(
        "\n".join(blk) for blk in description_blocks
    ).strip()

    # ── Дополнительные даты (многодневные) ───────────
    extra_dates = _extract_dates_fallback(text, date_str, day, month, year)

    # ── Контакты ─────────────────────────────────────
    contacts = _extract_contacts(text, entities)

    # ── Теги ─────────────────────────────────────────
    tags = _extract_tags(text)

    return {
        "title"             : title,
        "date"              : date_str,
        "time"              : time_str,
        "location"          : address,
        "address"           : address,
        "full_description"  : full_description,
        "short_description" : full_description[:200] if full_description else "",
        "description_blocks": description_blocks,
        "contacts"          : contacts,
        "tags"              : tags,
        "extra_dates"       : extra_dates,
    }


# ─── Вспомогательные функции ─────────────────────────

def _parse_time_from_text(text: str) -> str:
    """
    Ищет время во всём тексте: варианты с точкой (в 19.00, 19.00 - 23:00, 11.00),
    с двоеточием (19:00, в 19:00), а также диапазоны (извлекает только начало).
    Возвращает "ЧЧ:ММ" или "".
    """
    # 1. Конструкция "в ЧЧ.ММ" или "в ЧЧ:ММ"
    m = re.search(r'в\s+(\d{1,2})[.:](\d{2})', text, re.IGNORECASE)
    if m:
        h, mn = int(m.group(1)), int(m.group(2))
        if 0 <= h <= 23 and 0 <= mn <= 59:
            return f"{h:02d}:{mn:02d}"

    # 2. "Старт в / начало в / cтарт / начало ЧЧ.ММ" или ЧЧ:ММ
    m = re.search(r'(?:старт|начало)\s+в\s+(\d{1,2})[.:](\d{2})', text, re.IGNORECASE)
    if m:
        h, mn = int(m.group(1)), int(m.group(2))
        if 0 <= h <= 23 and 0 <= mn <= 59:
            return f"{h:02d}:{mn:02d}"

    # 3. Диапазон "ЧЧ.ММ - ЧЧ.ММ" или "ЧЧ:ММ-ЧЧ:ММ" — берём начало
    m = re.search(r'(\d{1,2})[.:](\d{2})\s*[-–—]\s*(\d{1,2})[.:](\d{2})', text)
    if m:
        h, mn = int(m.group(1)), int(m.group(2))
        if 0 <= h <= 23 and 0 <= mn <= 59:
            return f"{h:02d}:{mn:02d}"

    # 4. Просто "ЧЧ.ММ" или "ЧЧ:ММ" как слово
    m = re.search(r'(?<!\d)(\d{1,2})[.:](\d{2})(?!\s*[-–—]\s*\d)', text)
    if m:
        h, mn = int(m.group(1)), int(m.group(2))
        if 0 <= h <= 23 and 0 <= mn <= 59:
            return f"{h:02d}:{mn:02d}"

    return ""


def _extract_dates_fallback(
    text: str,
    first_date: str,
    first_day: int,
    first_month: int,
    first_year: int,
) -> List[str]:
    """
    Ищет в тексте поста дополнительные даты событий.
    Распознаёт форматы:
      - "02.06", "02.06.2026"
      - "02.06—05.06" (диапазон — возвращает список всех дат между)
      - "12 июня", "12 июня 2026"
    Возвращает список строк "DD.MM.YYYY" без первой (основной) даты.
    """
    now = datetime.now()
    extra: List[str] = []
    seen: set = {first_date}

    def _normalize(d: int, m: int) -> str:
        """Приводит день/месяц к строке DD.MM.YYYY с коррекцией года."""
        y = first_year
        dt = datetime(y, m, d)
        if dt < now - timedelta(days=30):
            y += 1
        return f"{d:02d}.{m:02d}.{y}"

    def _try_add(d: int, m: int) -> None:
        ds = _normalize(d, m)
        if ds not in seen:
            seen.add(ds)
            extra.append(ds)

    # 1. Диапазон "DD.MM—DD.MM" или "DD.MM - DD.MM" или "DD.MM–DD.MM"
    for m in re.finditer(
        r'(\d{1,2})\.(\d{1,2})\s*[-–—]\s*(\d{1,2})\.(\d{1,2})',
        text,
    ):
        d1, m1, d2, m2 = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
        # Валидация: месяц 1..12, день 1..31
        if not (1 <= m1 <= 12 and 1 <= m2 <= 12 and 1 <= d1 <= 31 and 1 <= d2 <= 31):
            continue
        try:
            dt1 = _normalize(d1, m1)
            dt2 = _normalize(d2, m2)
        except (ValueError, OverflowError):
            continue
        start_dt = datetime.strptime(dt1, "%d.%m.%Y")
        end_dt = datetime.strptime(dt2, "%d.%m.%Y")
        delta = (end_dt - start_dt).days

        # Пропускаем, если это тот же диапазон, что и основная дата (расширяем)
        if dt1 == first_date:
            for i in range(1, delta + 1):
                nd = start_dt + timedelta(days=i)
                extra.append(nd.strftime("%d.%m.%Y"))
            continue
        if dt2 == first_date:
            # Диапазон заканчивается на основную дату — добавляем предыдущие
            for i in range(delta):
                nd = start_dt + timedelta(days=i)
                ds = nd.strftime("%d.%m.%Y")
                if ds not in seen:
                    seen.add(ds)
                    extra.append(ds)
            continue

        # Иначе добавляем обе границы + промежуточные
        if 0 < delta <= 14:  # максимум 14 дней — защита от бесконечных серий
            for i in range(delta + 1):
                nd = start_dt + timedelta(days=i)
                ds = nd.strftime("%d.%m.%Y")
                if ds not in seen:
                    seen.add(ds)
                    extra.append(ds)

    # 2. Формат "DD.MM.YYYY" или "DD.MM" (точки).
    #    Требуем, чтобы после второй группы не шли буквы — чтобы не ловить "21. автобус".
    for m in re.finditer(r'(?<!\d)(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?(?![.\d])', text):
        d, mon = int(m.group(1)), int(m.group(2))
        # Валидация ДО вызова _normalize
        if not (1 <= d <= 31 and 1 <= mon <= 12):
            continue
        if m.group(3):
            y = int(m.group(3))
            ds = f"{d:02d}.{mon:02d}.{y}"
        else:
            try:
                ds = _normalize(d, mon)
            except (ValueError, OverflowError):
                continue
        if ds not in seen:
            seen.add(ds)
            extra.append(ds)

    # Фильтруем: оставляем только даты, отличные от первой, и сортируем
    extra = [e for e in extra if e != first_date]
    # Убираем дубликаты (на случай пересечений)
    extra = list(dict.fromkeys(extra))
    return extra


def _extract_contacts(text: str, entities: Optional[List[dict]]) -> str:
    # 1. Telegram entities (приоритет — точные гиперссылки)
    if entities:
        for ent in entities:
            t = ent.get("type")
            if t == "text_link" and ent.get("url"):
                return ent["url"].strip()
            if t == "url":
                offset, length = ent.get("offset", 0), ent.get("length", 0)
                if length > 0 and offset + length <= len(text):
                    extracted = text[offset : offset + length].strip()
                    if extracted:
                        return extracted

    # 2. Явные ссылки http/https/tg://
    m = re.search(r"(https?://\S+|tg://\S+)", text)
    if m:
        return m.group(1).strip()

    # 3. t.me / telegram.me без схемы
    m = re.search(r"\b(?:t\.me|telegram\.me)/([\w\d_\-]+)\b", text, re.I)
    if m:
        return f"https://t.me/{m.group(1)}"

    # 4. @username
    m = re.search(r"@([A-Za-z0-9_]{3,32})", text)
    if m:
        return "@" + m.group(1)

    return ""


def _extract_tags(text: str) -> List[str]:
    keywords = [
        "Концерт", "Вечеринка", "Фестиваль", "Выставка",
        "Лекция", "Спектакль", "Кинопоказ", "Йога",
    ]
    tags = [kw for kw in keywords if re.search(rf"\b{kw}\b", text, re.IGNORECASE)]

    if re.search(
        r"\b(вход\s+свободный|вход\s+бесплатный|бесплатный\s+вход|"
        r"свободный\s+вход|вход\s+free|бесплатно)\b",
        text, re.IGNORECASE,
    ):
        tags.append("Бесплатно")

    for h in re.findall(r"#(\w+)", text):
        if not h.lower().startswith("meow") and not any(t.lower() == h.lower() for t in tags):
            tags.append(h)

    return tags
