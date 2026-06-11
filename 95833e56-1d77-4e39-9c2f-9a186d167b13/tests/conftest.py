import os
import sys
import tempfile
import shutil
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
import hamlog


@pytest.fixture
def data_dir(tmp_path):
    return tmp_path


@pytest.fixture
def db(data_dir):
    os.environ["HAMLOG_DATA_DIR"] = str(data_dir)
    database = hamlog.Database()
    database.init_schema()
    yield database
    database.close()


@pytest.fixture
def qso_mgr(db):
    return hamlog.QSOMANAGER(db)


@pytest.fixture
def award_mgr(db):
    return hamlog.AwardManager(db)


@pytest.fixture
def sample_qso():
    return hamlog.QSO(
        callsign="W1AW", qso_date="20240115", qso_time="1200",
        band="20m", mode="SSB", freq=14.250
    )
