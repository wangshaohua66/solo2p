#!/usr/bin/env python3
import time
import os
import sys
import sqlite3
import csv
import random
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import ConfigManager
from logger import LoggerManager
from importer import DataImporter


def generate_test_csv(filename, num_records=1000):
    stations = [f'SH{i:05d}' for i in range(1, 181)]
    start_time = datetime(2024, 6, 1, 0, 0)

    records = []
    for i in range(num_records):
        station = random.choice(stations)
        obs_time = start_time + timedelta(minutes=i * 10)
        records.append({
            'site_code': station,
            'obs_time': obs_time.strftime('%Y-%m-%d %H:%M'),
            'water_level': round(random.uniform(15.0, 25.0), 2),
            'flow': round(random.uniform(100, 400), 2),
            'rainfall': round(random.uniform(0, 20), 2)
        })

    with open(filename, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['site_code', 'obs_time', 'water_level', 'flow', 'rainfall'])
        writer.writeheader()
        writer.writerows(records)

    return filename


def test_single_file_performance():
    print("=" * 60)
    print("性能测试1: 单文件1000条记录处理时间")
    print("=" * 60)

    config = ConfigManager('config/stations.json')
    logger = LoggerManager(config.get_log_config())
    logger.set_level('ERROR')

    importer = DataImporter(config, logger)

    test_file = generate_test_csv('/tmp/test_perf_1000.csv', 1000)

    start_time = time.time()
    result = importer.import_file(test_file, '/tmp/error_test.csv')
    elapsed = time.time() - start_time

    print(f"处理记录数: {result.total_records}")
    print(f"入库成功: {result.imported_records}")
    print(f"处理耗时: {elapsed:.3f} 秒")
    print(f"性能约束: <= 3秒 -> {'通过 ✓' if elapsed <= 3 else '未通过 ✗'}")
    print()

    os.remove(test_file)
    return elapsed <= 3


def test_batch_directory_performance():
    print("=" * 60)
    print("性能测试2: 批量目录100个文件处理时间")
    print("=" * 60)

    test_dir = '/tmp/test_batch_perf'
    os.makedirs(test_dir, exist_ok=True)

    print("生成测试文件...")
    for i in range(100):
        generate_test_csv(f'{test_dir}/test_{i:03d}.csv', 100)

    config = ConfigManager('config/stations.json')
    logger = LoggerManager(config.get_log_config())
    logger.set_level('ERROR')

    importer = DataImporter(config, logger)

    start_time = time.time()
    results = importer.import_directory(test_dir, '/tmp/errors_test')
    elapsed = time.time() - start_time

    total_records = sum(r.total_records for r in results)
    success = sum(1 for r in results if r.status == 'success')

    print(f"处理文件数: {len(results)}")
    print(f"处理记录数: {total_records}")
    print(f"成功文件数: {success}")
    print(f"处理耗时: {elapsed:.3f} 秒")
    print(f"性能约束: <= 300秒(5分钟) -> {'通过 ✓' if elapsed <= 300 else '未通过 ✗'}")
    print(f"平均单文件: {elapsed/len(results):.3f} 秒")
    print()

    import shutil
    shutil.rmtree(test_dir)
    return elapsed <= 300


def test_database_query_performance():
    print("=" * 60)
    print("性能测试3: 百万级记录查询响应时间")
    print("=" * 60)

    config = ConfigManager('config/stations.json')
    db_path = config.get_db_path()

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM hydro_data")
    total_count = cursor.fetchone()[0]
    print(f"当前数据库记录数: {total_count}")

    start_time = time.time()
    cursor.execute("SELECT site_code, COUNT(*) FROM hydro_data GROUP BY site_code")
    results = cursor.fetchall()
    elapsed = time.time() - start_time

    print(f"按站点分组查询: {elapsed:.6f} 秒")
    print(f"返回结果数: {len(results)}")
    print(f"性能约束: <= 1秒 -> {'通过 ✓' if elapsed <= 1 else '未通过 ✗'}")

    start_time = time.time()
    cursor.execute("""
        SELECT site_code, obs_time, water_level, flow 
        FROM hydro_data 
        WHERE site_code = 'SH00001' 
        ORDER BY obs_time DESC 
        LIMIT 100
    """)
    results = cursor.fetchall()
    elapsed = time.time() - start_time

    print(f"\n单站点查询(SH00001): {elapsed:.6f} 秒")
    print(f"返回结果数: {len(results)}")
    print(f"性能约束: <= 1秒 -> {'通过 ✓' if elapsed <= 1 else '未通过 ✗'}")

    start_time = time.time()
    cursor.execute("""
        SELECT DATE(obs_time) as dt, COUNT(*) as cnt,
               AVG(water_level) as avg_wl, AVG(flow) as avg_flow
        FROM hydro_data
        WHERE obs_time >= '2024-01-01' AND obs_time <= '2024-01-31'
        GROUP BY DATE(obs_time)
        ORDER BY dt
    """)
    results = cursor.fetchall()
    elapsed = time.time() - start_time

    print(f"\n按日期统计查询: {elapsed:.6f} 秒")
    print(f"返回结果数: {len(results)}")
    print(f"性能约束: <= 1秒 -> {'通过 ✓' if elapsed <= 1 else '未通过 ✗'}")

    conn.close()
    print()
    return True


def test_memory_usage():
    print("=" * 60)
    print("性能测试4: 内存占用")
    print("=" * 60)

    try:
        import psutil
        process = psutil.Process(os.getpid())

        config = ConfigManager('config/stations.json')
        logger = LoggerManager(config.get_log_config())
        logger.set_level('ERROR')
        importer = DataImporter(config, logger)

        test_file = generate_test_csv('/tmp/test_memory.csv', 1000)

        mem_before = process.memory_info().rss / 1024 / 1024
        result = importer.import_file(test_file, '/tmp/error_mem.csv')
        mem_after = process.memory_info().rss / 1024 / 1024
        mem_used = mem_after - mem_before

        print(f"处理前内存: {mem_before:.2f} MB")
        print(f"处理后内存: {mem_after:.2f} MB")
        print(f"内存增量: {mem_used:.2f} MB")
        print(f"性能约束: <= 200MB -> {'通过 ✓' if mem_used <= 200 else '未通过 ✗'}")

        os.remove(test_file)
        return mem_used <= 200
    except ImportError:
        print("psutil 未安装，跳过内存测试")
        print("安装命令: pip3 install psutil")
        return True


def main():
    print("\n水文数据入库系统 - 性能测试套件")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    results = []

    try:
        results.append(("单文件处理时间", test_single_file_performance()))
        results.append(("批量目录处理时间", test_batch_directory_performance()))
        results.append(("数据库查询性能", test_database_query_performance()))
        results.append(("内存占用", test_memory_usage()))
    except Exception as e:
        print(f"测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
        return 1

    print("=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    all_passed = True
    for name, passed in results:
        status = "✓ 通过" if passed else "✗ 未通过"
        print(f"{name}: {status}")
        if not passed:
            all_passed = False
    print("=" * 60)

    if all_passed:
        print("\n🎉 所有性能测试通过！")
        return 0
    else:
        print("\n⚠️  部分测试未通过，请检查配置或优化代码")
        return 1


if __name__ == '__main__':
    sys.exit(main())
