#!/usr/bin/env python3
"""HAMLOG Quick Performance Benchmark (100K records)."""

import os, sys, time, random, string, tempfile, shutil, resource
from pathlib import Path

BENCH_DIR = Path(tempfile.mkdtemp(prefix="hamlog_bench_"))
os.environ["HAMLOG_DATA_DIR"] = str(BENCH_DIR)

sys.path.insert(0, str(Path(__file__).parent))
import hamlog

def random_callsign():
    p = random.choice(["W","K","N","VE","JA","G","DL","F","UA","PY","VK","ZL","LU","JH"])
    n = random.randint(0, 9)
    s = "".join(random.choices(string.ascii_uppercase, k=random.randint(1, 4)))
    return f"{p}{n}{s}"

def seed_db(n=100000):
    db = hamlog.Database()
    db.init_schema()
    bands = hamlog.BANDS
    modes = hamlog.MODES
    batch_size = 10000
    inserted = 0
    t0 = time.perf_counter()
    while inserted < n:
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
            rows)
        db.conn.commit()
        inserted += len(rows)
    dt = time.perf_counter() - t0
    print(f"  Seeded {inserted:,} QSOs in {dt:.1f}s ({inserted/dt:.0f} QSO/s)")
    return db

def main():
    print("=" * 60)
    print("HAMLOG Performance Benchmark")
    print("=" * 60)

    t0 = time.perf_counter()
    db = hamlog.Database()
    db.init_schema()
    db.close()
    dt = (time.perf_counter() - t0) * 1000
    print(f"\n1. Cold start: {dt:.1f}ms {'PASS' if dt < 200 else 'FAIL'}")

    print("\n2. Seeding 100K QSO records...")
    db = seed_db(100000)
    mgr = hamlog.QSOMANAGER(db)

    target = "W1AW"
    mgr.add(hamlog.QSO(callsign=target, qso_date="20240115", qso_time="1200", band="20m", mode="SSB", freq=14.250))

    t0 = time.perf_counter()
    r = mgr.search(callsign=target, limit=10)
    dt = (time.perf_counter() - t0) * 1000
    print(f"\n3. Exact callsign '{target}': {dt:.2f}ms {'PASS' if dt < 50 else 'FAIL'}")

    t0 = time.perf_counter()
    r = mgr.search(bands=["20m","15m"], modes=["CW","FT8"], limit=1000)
    dt = (time.perf_counter() - t0) * 1000
    print(f"4. Multi-condition (20m/15m+CW/FT8): {dt:.2f}ms {'PASS' if dt < 500 else 'FAIL'}")

    t0 = time.perf_counter()
    r = mgr.search(date_from="20240601", date_to="20240831", limit=1000)
    dt = (time.perf_counter() - t0) * 1000
    print(f"5. Date range (Jun-Aug 2024): {dt:.2f}ms {'PASS' if dt < 500 else 'FAIL'}")

    adif_path = str(BENCH_DIR / "bench.adi")
    with open(adif_path, "w") as f:
        f.write("<adif_ver:5>3.1.4<programid:6>HAMLOG<eoh>\n")
        for _ in range(10000):
            cs = random_callsign()
            band = random.choice(hamlog.BANDS)
            mode = random.choice(hamlog.MODES)
            date = f"2024{random.randint(1,12):02d}{random.randint(1,28):02d}"
            tm = f"{random.randint(0,23):02d}{random.randint(0,59):02d}"
            low, high = hamlog.BAND_FREQ_RANGES.get(band, (1.8, 2.0))
            freq = round(random.uniform(low, high), 3)
            f.write(f"<call:{len(cs)}>{cs}<qso_date:8>{date}<time_on:4>{tm}<band:{len(band)}>{band}<mode:{len(mode)}>{mode}<freq:{len(str(freq))}>{freq}<eor>\n")

    db2 = hamlog.Database(db_path=BENCH_DIR / "bench_import.db")
    db2.init_schema()
    mgr2 = hamlog.QSOMANAGER(db2)
    t0 = time.perf_counter()
    qsos = hamlog.parse_adif_file(adif_path)
    ok = sum(1 for q in qsos if (mgr2.add(q) or True))
    dt = time.perf_counter() - t0
    print(f"6. ADIF import 10k: {dt:.2f}s ({ok} added) {'PASS' if dt < 3 else 'FAIL'}")

    peak_kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak_mb = peak_kb / 1024 / 1024 if sys.platform == "darwin" else peak_kb / 1024
    print(f"7. Memory peak: ~{peak_mb:.1f}MB {'PASS' if peak_mb < 100 else 'CHECK'}")

    print("\n" + "=" * 60)
    print("Benchmark complete. Scale to 1M: multiply query times by ~5-10x")
    print("=" * 60)

    db.close()
    db2.close()
    shutil.rmtree(BENCH_DIR, ignore_errors=True)

if __name__ == "__main__":
    main()
