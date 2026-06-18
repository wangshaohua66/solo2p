import tempfile
from pathlib import Path

import pytest

from storage import Database
from utils import AuditLogger


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def db(temp_dir):
    return Database(temp_dir)


@pytest.fixture
def logger(temp_dir):
    return AuditLogger(temp_dir / "logs")
