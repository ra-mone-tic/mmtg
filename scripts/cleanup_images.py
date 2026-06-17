#!/usr/bin/env python3
"""
Очистка локально сохранённых изображений (thumbnail) старше N дней.
По умолчанию — 7 дней.

Изображения в Supabase Storage уже очищаются Edge Function cleanup-old-images.
Этот скрипт — дополнительная страховка для локальных копий.
"""
import logging
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Папка с изображениями — корень проекта /images/
IMAGES_DIR = Path(__file__).resolve().parent.parent / "images"


def cleanup_old_images(days: int = 7) -> int:
    """Удаляет файлы старше `days` дней из IMAGES_DIR. Возвращает количество удалённых."""
    if not IMAGES_DIR.exists():
        logger.info(f"Папка {IMAGES_DIR} не существует, пропускаем")
        return 0

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    removed = 0

    for fpath in IMAGES_DIR.iterdir():
        if not fpath.is_file():
            continue

        # Проверяем mtime
        mtime = datetime.fromtimestamp(fpath.stat().st_mtime, tz=timezone.utc)
        if mtime < cutoff:
            try:
                fpath.unlink()
                logger.info(f"Удалён: {fpath.name}")
                removed += 1
            except OSError as e:
                logger.warning(f"Не удалось удалить {fpath.name}: {e}")

    logger.info(f"Очистка завершена: удалено {removed} файлов")
    return removed


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Очистка старых изображений")
    parser.add_argument(
        "--days", type=int, default=7,
        help="Максимальный возраст файлов в днях (по умолчанию 7)",
    )
    args = parser.parse_args()
    cleanup_old_images(days=args.days)