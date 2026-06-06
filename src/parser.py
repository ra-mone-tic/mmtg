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

    lines = [l.strip() for l in text.strip().split("\n") if l.strip()]
    if not lines:
        return None

    # ── Дата и заголовок ────────────────────────────
    m = re.search(
        r"(\d{1,2})\.(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?\s*[|–—\-]\s*(.+)$",
        lines[0],
    )
    if not m:
        logger.debug(f"Не удалось распарсить первую строку: {lines[0]!r}")
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
        tm = re.search(r'в\s+(\d{1,2}):(\d{2})', text, re.IGNORECASE) \
          or re.search(r'\b(\d{1,2}):(\d{2})\b', text)
        if tm:
            h, mn = int(tm.group(1)), int(tm.group(2))
            time_str = f"{h:02d}:{mn:02d}" if 0 <= h <= 23 and 0 <= mn <= 59 else ""
        else:
            time_str = ""

    # ── Адрес ────────────────────────────────────────
    addr_m = re.search(r"📍\s*(.+)", text)
    if not addr_m:
        logger.debug(f"Нет адреса (📍) в посте: {title!r}")
        return None
    address = addr_m.group(1).strip().rstrip(".")

    # ── Описание ─────────────────────────────────────
    desc_lines = []
    for line in lines[1:]:
        if line.startswith("📍") or line.startswith("➡️") or line.startswith("#"):
            break
        desc_lines.append(line)
    full_description = "\n".join(desc_lines).strip()

    # ── Контакты ─────────────────────────────────────
    contacts = _extract_contacts(text, entities)

    # ── Теги ─────────────────────────────────────────
    tags = _extract_tags(text)

    return {
        "title"            : title,
        "date"             : date_str,
        "time"             : time_str,
        "location"         : address,
        "address"          : address,
        "full_description" : full_description,
        "short_description": full_description[:200] if full_description else "",
        "contacts"         : contacts,
        "tags"             : tags,
    }


# ─── Вспомогательные функции ─────────────────────────

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
