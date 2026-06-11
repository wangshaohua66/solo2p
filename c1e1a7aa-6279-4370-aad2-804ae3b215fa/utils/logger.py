import sys
from pathlib import Path
from loguru import logger
from typing import Optional


def setup_logger(log_dir: str = "logs", log_level: str = "INFO") -> None:
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)

    logger.remove()

    logger.add(
        sys.stderr,
        level="ERROR",
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        enqueue=True,
    )

    logger.add(
        log_path / "inkmixer_{time:YYYY-MM-DD}.log",
        level=log_level,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        rotation="00:00",
        retention="30 days",
        compression="zip",
        enqueue=True,
        encoding="utf-8",
    )

    logger.add(
        log_path / "error_{time:YYYY-MM-DD}.log",
        level="ERROR",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        rotation="00:00",
        retention="90 days",
        compression="zip",
        enqueue=True,
        encoding="utf-8",
    )


def get_logger():
    return logger
