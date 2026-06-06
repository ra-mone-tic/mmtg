"""
MeowAfisha · src/telegram_api.py
Работа с Telegram Bot API: получение обновлений, скачивание фото.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import TELEGRAM_BOT_TOKEN, CHANNEL_USERNAME
from .utils  import session

logger = logging.getLogger(__name__)


def get_channel_messages(offset: Optional[int] = None, limit: int = 50) -> List[dict]:
    """
    Получает channel_post через Bot API getUpdates (POST + JSON).

    Важно: используем POST + json=, а не GET + params=.
    Иначе allowed_updates сериализуется как строка, а не JSON-массив,
    и Telegram игнорирует параметр — channel_post не возвращаются.
    """
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN не задан!")
        return []

    payload: Dict[str, Any] = {
        "timeout"        : 0,
        "limit"          : limit,
        "allowed_updates": ["channel_post"],
    }
    if offset:
        payload["offset"] = offset

    try:
        resp = session.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates",
            json=payload,
            timeout=15,
        )
        if resp.status_code != 200:
            logger.error(f"Telegram API HTTP {resp.status_code}: {resp.text[:200]}")
            return []

        data = resp.json()
        if not data.get("ok"):
            logger.error(f"Telegram API error: {data}")
            return []

        messages = []
        channel = CHANNEL_USERNAME.lstrip("@").lower()
        for update in data.get("result", []):
            msg  = update.get("channel_post") or update.get("message") or {}
            chat = msg.get("chat", {})
            if chat.get("username", "").lower() == channel:
                # Не мутируем оригинальный dict из API-ответа
                messages.append({**msg, "update_id": update["update_id"]})
        return messages

    except Exception as e:
        logger.error(f"Telegram API request failed: {e}")
        return []


def get_file_url(file_id: str) -> Optional[str]:
    if not TELEGRAM_BOT_TOKEN:
        return None
    try:
        resp = session.get(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getFile",
            params={"file_id": file_id},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            fp   = data.get("result", {}).get("file_path")
            if data.get("ok") and fp:
                return f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{fp}"
    except Exception as e:
        logger.warning(f"Failed to get file URL: {e}")
    return None


def download_image(url: str, dest: Path) -> bool:
    try:
        resp = session.get(url, timeout=30)
        if resp.status_code == 200:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(resp.content)
            logger.info(f"Скачано изображение: {dest}")
            return True
        logger.warning(f"Не удалось скачать изображение: HTTP {resp.status_code}")
    except Exception as e:
        logger.warning(f"Не удалось скачать {url}: {e}")
    return False
