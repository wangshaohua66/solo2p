#!/usr/bin/env python3
"""HAMLOG 1M Performance Benchmark - actual measurement, no extrapolation."""

import os
import sys
import time
import random
import string
import tempfile
import shutil
import resource
from pathlib import Path

BENCH_DIR = Path(tempfile.mkdtemp(prefix="hamlog_bench_1m_"))
os.environ["HAMLOG_DATA_DIR"] = str(BENCH_DIR)

sys.path.insert(0, str(Path(__file__).parent))
import hamlog


def random_callsign():
    prefixes = [
        "W", "K", "N", "VE", "JA", "G", "DL", "F", "UA", "PY",
        "VK", "ZL", "LU", "JH", "HL", "BV", "HS", "VU", "4X", "SU",
        "CN", "5B", "SV", "I", "OE", "HB", "LA", "OH", "SM", "OZ",
        "PA", "ON", "F", "G", "EI", "GM", "GW", "GU", "GD", "GJ",
    ]
    p = random.choice(prefixes)
    n = random.randint(0, 9)
    s = "".join(random.choices(string.ascii_uppercase, k=random.randint(1, 4)))
    return f"{p}{n}{s}"


def seed_1m_records(db):
    bands = hamlog.BANDS
    modes = hamlog.MODES
    target_count = 1_000_000
    batch_size = 50_000

    print(f"Seeding {target_count:,} QSO records (batch SQL)...")
    t0 = time.perf_counter()
    inserted = 0

    while inserted < target_count:
        rows = []
        for _ in range(batch_size):
            cs = random_callsign()
            band = random.choice(bands)
            mode = random.choice(modes)
            date = f"2024{random.randint(1,12):02d}{random.randint(1,28):02d}"
            tm = f"{random.randint(0,23):02d}{random.randint(0,59):02d}"
            low, high = hamlog.BAND_FREQ_RANGES.get(band, (1.8, 2.0))
            freq = round(random.uniform(low, high), 3)
            rows.append((cs, date, tm, band, mode, freq, "59", "59", "N", "N", "N", "N"))

        db.conn.executemany(
            "INSERT OR IGNORE INTO qsos (callsign,qso_date,qso_time,band,mode,freq,rst_sent,rst_rcvd,qsl_rcvd,qsl_sent,lotw_rcvd,lotw_sent) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            rows,
        )
        db.conn.commit()
        inserted += len(rows)
        elapsed = time.perf_counter() - t0
        pct = inserted / target_count * 100
        rate = inserted / elapsed if elapsed > 0 else 0
        print(f"  {inserted:>10,} / {target_count:,}  ({pct:5.1f}%)  {rate:,.0f} QSO/s", flush=True)

    dt = time.perf_counter() - t0
    print(f"Seeded {inserted:,} QSOs in {dt:.1f}s ({inserted/dt:,.0f} QSO/s)")
    return inserted


def run_query_benchmark(mgr, target_cs):
    results = {}

    print("\n--- Query Benchmarks (1M records) ---")

    t0 = time.perf_counter()
    r = mgr.search(callsign=target_cs, limit=10)
    dt = (time.perf_counter() - t0) * 1000
    passed = dt < 50
    print(f"1. Exact callsign '{target_cs}': {dt:.2f}ms ({len(r)} results) {'PASS' if passed else 'FAIL'}")
    results["exact_callsign"] = (dt, passed)

    t0 = time.perf_counter()
    r = mgr.search(bands=["20m", "15m"], modes=["CW", "FT8"], limit=1000)
    dt = (time.perf_counter() - t0) * 1000
    passed = dt < 500
    print(f"2. Multi-condition (20m/15m+CW/FT8): {dt:.2f}ms ({len(r)} results) {'PASS' if passed else 'FAIL'}")
    results["multi_condition"] = (dt, passed)

    t0 = time.perf_counter()
    r = mgr.search(date_from="20240601", date_to="20240831", limit=1000)
    dt = (time.perf_counter() - t0) * 1000
    passed = dt < 500
    print(f"3. Date range (Jun-Aug 2024): {dt:.2f}ms ({len(r)} results) {'PASS' if passed else 'FAIL'}")
    results["date_range"] = (dt, passed)

    t0 = time.perf_counter()
    r = mgr.search(callsign="W1AW", limit=10)
    dt = (time.perf_counter() - t0) * 1000
    passed = dt < 50
    print(f"4. Common callsign 'W1AW': {dt:.2f}ms ({len(r)} results) {'PASS' if passed else 'FAIL'}")
    results["common_callsign"] = (dt, passed)

    return results


def main():
    print("=" * 60)
    print("HAMLOG 1M Performance Benchmark")
    print("=" * 60)

    print("\n0. Cold start test (< 200ms):")
    t0 = time.perf_counter()
    db = hamlog.Database()
    db.init_schema()
    dt = (time.perf_counter() - t0) * 1000
    print(f"  Cold start: {dt:.1f}ms {'PASS' if dt < 200 else 'FAIL'}")
    db.close()

    print()
    db = hamlog.Database()
    db.init_schema()
    count = seed_1m_records(db)

    if count >= 1_000_000:
        mgr = hamlog.QSOMANAGER(db)
        target = "W1AW"
        mgr.add(hamlog.QSO(callsign=target, qso_date="20240115", qso_time="1200", band="20m", mode="SSB", freq=14.250))
        run_query_benchmark(mgr, target)
    else:
        print(f"ERROR: Only seeded {count:,} records, expected 1M")

    peak_kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak_mb = peak_kb / 1024 / 1024 if sys.platform == "darwin" else peak_kb / 1024
    print(f"\nMemory peak: ~{peak_mb:.1f}MB")

    db.close()
    print("\n" + "=" * 60)
    print("1M Benchmark complete.")
    print("=" * 60)

    shutil.rmtree(BENCH_DIR, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
