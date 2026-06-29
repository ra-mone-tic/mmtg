#!/usr/bin/env python3
"""
MeowAfisha · parse_telegram.py
Точка входа: читает обновления из Telegram-канала @meowafisha,
парсит и геокодирует события, сохраняет в events.json.

Запуск:
  - локально:       python parse_telegram.py
  - GitHub Actions: по cron
"""
from __future__ import annotations

import logging
import sys

from src.config    import TELEGRAM_BOT_TOKEN
from src.storage   import (load_existing_events, load_geocache, load_state,
                           save_geocache, save_state, sync_to_supabase)
from src.telegram_api import get_channel_messages
from src.processor    import process_messages

# ─── Logging ────────────────────────────────────────

class TokenFilter(logging.Filter):
    """Маскирует TELEGRAM_BOT_TOKEN в логах."""
    def filter(self, record):
        if TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_TOKEN in str(record.msg):
            record.msg = str(record.msg).replace(TELEGRAM_BOT_TOKEN, 'BOT_TOKEN')
        return True

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
# TokenFilter добавляем на root logger, чтобы он покрывал все дочерние логгеры
# (src.telegram_api, src.parser, src.processor и т.д.)
logging.getLogger().addFilter(TokenFilter())
logger = logging.getLogger(__name__)


def main() -> None:
    logger.info("=" * 50)
    logger.info("Запуск парсинга Telegram-канала")
    logger.info("=" * 50)

    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN не задан!")
        sys.exit(1)

    existing = load_existing_events()
    geocache = load_geocache()
    state    = load_state()

    logger.info(
        f"Существующих событий: {len(existing)}, "
        f"кэш: {len(geocache)}, "
        f"last_update_id: {state.get('last_update_id', 0)}"
    )

    offset = (int(state["last_update_id"]) + 1) if state.get("last_update_id") else None
    messages = get_channel_messages(offset=offset)

    if not messages:
        logger.info("Нет сообщений для обработки")
        save_geocache(geocache)
        save_state(state)
        return

    logger.info(f"Получено {len(messages)} сообщений из канала")

    max_uid = max(m.get("update_id", 0) for m in messages)
    if max_uid:
        state["last_update_id"] = max_uid

    all_events, added, updated = process_messages(messages, existing, geocache)

    # ── Синхронизация в Supabase (всегда) ────────────
    if added or updated:
        logger.info(f"События обновлены: +{added}, ~{updated}")
    else:
        logger.info("Изменений нет")

    sync_result = sync_to_supabase(all_events)
    if sync_result.get("error"):
        logger.warning(f"Supabase sync failed: {sync_result['error']}")
    else:
        logger.info(f"Supabase sync: {sync_result.get('upserted', 0)} событий")

    save_geocache(geocache)
    save_state(state)
    logger.info("Готово!")


if __name__ == "__main__":
    main()
