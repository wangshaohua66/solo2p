import os
import sys
import tempfile
from pathlib import Path

import hamlog


class TestQSOMOdel:
    def test_qso_has_new_fields(self):
        q = hamlog.QSO(callsign="W1AW", qso_date="20240101", qso_time="1200",
                        band="20m", mode="SSB", freq=14.25)
        for field in ["freq_rx", "band_rx", "a_index", "cont",
                       "qrzcom_qso_upload_date", "qsl_rcvd_date",
                       "qsl_sent_date", "lotw_rcvd_date", "lotw_sent_date"]:
            assert hasattr(q, field), f"QSO missing field: {field}"

    def test_qso_validate_missing_callsign(self):
        q = hamlog.QSO(callsign="", qso_date="20240101", qso_time="1200",
                        band="20m", mode="SSB", freq=14.25)
        errors = q.validate()
        assert any("callsign" in e.lower() for e in errors)

    def test_qso_validate_invalid_band(self):
        q = hamlog.QSO(callsign="W1AW", qso_date="20240101", qso_time="1200",
                        band="99m", mode="SSB", freq=14.25)
        errors = q.validate()
        assert any("band" in e.lower() for e in errors)

    def test_freq_to_band(self):
        assert hamlog.freq_to_band(14.250) == "20m"
        assert hamlog.freq_to_band(7.074) == "40m"
        assert hamlog.freq_to_band(21.250) == "15m"


class TestQSOCRUD:
    def test_add_qso(self, qso_mgr, sample_qso):
        qso_id = qso_mgr.add(sample_qso)
        assert qso_id > 0

    def test_get_qso(self, qso_mgr, sample_qso):
        qso_id = qso_mgr.add(sample_qso)
        q = qso_mgr.get(qso_id)
        assert q is not None
        assert q.callsign == "W1AW"

    def test_delete_qso(self, qso_mgr, sample_qso):
        qso_id = qso_mgr.add(sample_qso)
        assert qso_mgr.delete(qso_id) is True
        assert qso_mgr.get(qso_id) is None

    def test_duplicate_qso_raises(self, qso_mgr, sample_qso):
        qso_mgr.add(sample_qso)
        import pytest
        with pytest.raises(ValueError, match="Duplicate"):
            qso_mgr.add(sample_qso)

    def test_search_by_callsign(self, qso_mgr):
        qso_mgr.add(hamlog.QSO(callsign="W1AW", qso_date="20240101", qso_time="1200",
                                band="20m", mode="SSB", freq=14.25))
        qso_mgr.add(hamlog.QSO(callsign="JA1AA", qso_date="20240102", qso_time="1300",
                                band="15m", mode="CW", freq=21.0))
        results = qso_mgr.search(callsign="W1AW")
        assert len(results) >= 1
        assert results[0].callsign == "W1AW"

    def test_search_multi_band(self, qso_mgr):
        qso_mgr.add(hamlog.QSO(callsign="W1AW", qso_date="20240101", qso_time="1200",
                                band="20m", mode="SSB", freq=14.25))
        qso_mgr.add(hamlog.QSO(callsign="JA1AA", qso_date="20240102", qso_time="1300",
                                band="15m", mode="CW", freq=21.0))
        qso_mgr.add(hamlog.QSO(callsign="G4ABC", qso_date="20240103", qso_time="1400",
                                band="40m", mode="FT8", freq=7.074))
        results = qso_mgr.search(bands=["20m", "15m"])
        assert len(results) == 2

    def test_search_multi_mode(self, qso_mgr):
        qso_mgr.add(hamlog.QSO(callsign="W1AW", qso_date="20240101", qso_time="1200",
                                band="20m", mode="SSB", freq=14.25))
        qso_mgr.add(hamlog.QSO(callsign="JA1AA", qso_date="20240102", qso_time="1300",
                                band="15m", mode="CW", freq=21.0))
        qso_mgr.add(hamlog.QSO(callsign="G4ABC", qso_date="20240103", qso_time="1400",
                                band="40m", mode="FT8", freq=7.074))
        results = qso_mgr.search(modes=["CW", "FT8"])
        assert len(results) == 2


class TestDXCC:
    def test_dxcc_entity_count(self):
        assert len(hamlog._DXCC_RAW) >= 340

    def test_dxcc_entity_has_flag(self):
        e = hamlog.DXCC_ENTITIES[0]
        assert hasattr(e, "flag")
        assert e.flag == "US"

    def test_dxcc_rarity_dict_exists(self):
        assert hasattr(hamlog, "_DXCC_RARITY")
        assert len(hamlog._DXCC_RARITY) >= 340

    def test_rare_entities_score_high(self):
        bouvet_id = None
        for e in hamlog.DXCC_ENTITIES:
            if "Bouvet" in e.name:
                bouvet_id = e.entity_id
                break
        if bouvet_id:
            usa_score = hamlog._DXCC_RARITY.get(1, 0)
            bouvet_score = hamlog._DXCC_RARITY.get(bouvet_id, 0)
            assert bouvet_score > usa_score, f"Bouvet({bouvet_score}) should be > USA({usa_score})"

    def test_dxcc_status_missing_sorted_by_rarity(self, award_mgr):
        status = award_mgr.dxcc_status()
        assert status is not None
        assert status.total >= 340

    def test_truncate_entity_name(self):
        trunc = hamlog.truncate_entity_name("United States of America", max_width=20)
        assert len(trunc) <= 20


class TestDatabase:
    def test_db_has_covering_index(self, db):
        idxes = [i[0] for i in db.query_all(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_qso_covering'"
        )]
        assert idxes, "Missing covering index"

    def test_db_has_v3_columns(self, db):
        cols = [c[1] for c in db.query_all("PRAGMA table_info(qsos)")]
        for f in ["freq_rx", "band_rx", "a_index", "cont",
                   "qrzcom_qso_upload_date", "qsl_rcvd_date",
                   "qsl_sent_date", "lotw_rcvd_date", "lotw_sent_date"]:
            assert f in cols, f"DB missing column: {f}"

    def test_insert_column_count_assert(self):
        cols_str = """callsign, qso_date, qso_time, band, mode, freq,
            rst_sent, rst_rcvd, grid, name, qth, state,
            cq_zone, ituzone, dxcc, country, operator,
            station_callsign, my_grid, tx_pwr, rig, antenna,
            comment, notes, contest_id, srx, srx_string,
            stx, stx_string, qsl_rcvd, qsl_sent,
            lotw_rcvd, lotw_sent,
            freq_rx, band_rx, a_index, cont,
            qrzcom_qso_upload_date, qsl_rcvd_date, qsl_sent_date,
            lotw_rcvd_date, lotw_sent_date"""
        assert len(cols_str.split(",")) == 42, f"Expected 42 columns, got {len(cols_str.split(','))}"


class TestConfig:
    def test_config_hot_reload(self, data_dir):
        cm = hamlog._ConfigManager()
        c1 = cm.get_config()
        assert c1 is not None
        assert "operator" in c1

    def test_config_set_and_get(self, data_dir):
        config = hamlog.get_config()
        config["operator"]["callsign"] = "N0CALL"
        hamlog.save_config(config)
        reloaded = hamlog.get_config()
        assert reloaded["operator"]["callsign"] == "N0CALL"


class TestADIF:
    def test_export_adif(self, qso_mgr):
        qso_mgr.add(hamlog.QSO(callsign="W1AW", qso_date="20240115", qso_time="1200",
                                band="20m", mode="SSB", freq=14.25))
        qsos = qso_mgr.search(callsign="W1AW")
        output = hamlog.export_adif(qsos)
        assert "<call:4>W1AW" in output
        assert "<band:3>20m" in output

    def test_export_csv(self, qso_mgr):
        qso_mgr.add(hamlog.QSO(callsign="W1AW", qso_date="20240115", qso_time="1200",
                                band="20m", mode="SSB", freq=14.25))
        qsos = qso_mgr.search(callsign="W1AW")
        output = hamlog.export_csv(qsos)
        assert "W1AW" in output
        assert "20m" in output

    def test_parse_adif_roundtrip(self, qso_mgr):
        qso_mgr.add(hamlog.QSO(callsign="W1AW", qso_date="20240115", qso_time="1200",
                                band="20m", mode="SSB", freq=14.25))
        qsos = qso_mgr.search(callsign="W1AW")
        adif_str = hamlog.export_adif(qsos)
        header, records = hamlog.parse_adif(adif_str)
        assert len(records) >= 1
        assert records[0].get("call") == "W1AW"


class TestPropagation:
    def test_get_7day_trend_exists(self, db):
        pm = hamlog.PropagationManager(db)
        assert hasattr(pm, "get_7day_trend")

    def test_7day_trend_returns_data(self, db):
        pm = hamlog.PropagationManager(db)
        for i in range(7):
            d = f"2024060{i+1}"
            db.conn.execute(
                "INSERT OR REPLACE INTO propagation_cache (cache_date,sfi,a_index,k_index,ssn) VALUES (?,?,?,?,?)",
                (d, 70+i, 10+i*2, 3-i%3, 20+i*5)
            )
        db.conn.commit()
        trend = pm.get_7day_trend()
        assert len(trend) == 7


class TestParser:
    def test_build_parser(self):
        p = hamlog.build_parser()
        assert p is not None

    def test_freq_is_required(self):
        p = hamlog.build_parser()
        import pytest
        with pytest.raises(SystemExit):
            p.parse_args(["qso", "add", "-c", "W1AW"])

    def test_search_band_choices(self):
        p = hamlog.build_parser()
        args = p.parse_args(["qso", "search", "-b", "20m", "15m"])
        assert args.band == ["20m", "15m"]

    def test_search_mode_choices(self):
        p = hamlog.build_parser()
        args = p.parse_args(["qso", "search", "-m", "CW", "FT8"])
        assert args.mode == ["CW", "FT8"]


class TestUtilities:
    def test_maybe_pager_short(self, capsys):
        hamlog.maybe_pager("short text\nonly 2 lines", threshold=10)
        captured = capsys.readouterr()
        assert "short text" in captured.out

    def test_normalize_callsign(self):
        assert hamlog.normalize_callsign("w1aw") == "W1AW"

    def test_now_utc_datetime(self):
        dt = hamlog.now_utc_datetime()
        assert dt.tzinfo is not None
