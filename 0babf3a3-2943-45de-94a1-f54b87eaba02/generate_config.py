#!/usr/bin/env python3
import json
import csv
import random
from datetime import datetime, timedelta
import os


def generate_station_config():
    cities = ['南京', '苏州', '无锡', '常州', '镇江', '扬州', '泰州', '南通',
              '盐城', '淮安', '宿迁', '连云港', '徐州']
    districts = ['玄武区', '秦淮区', '建邺区', '鼓楼区', '浦口区', '栖霞区',
                 '雨花台区', '江宁区', '六合区', '溧水区', '高淳区']
    rivers = ['长江', '淮河', '太湖', '洪泽湖', '京杭运河', '滁河', '秦淮河',
              '沂河', '沭河', '新沂河', '新沭河', '苏北灌溉总渠']

    stations = []
    idx = 0

    for city in cities:
        for river in rivers:
            if idx >= 180:
                break
            for i in range(1, 3):
                if idx >= 180:
                    break
                district = districts[idx % len(districts)]
                station_code = f'SH{idx+1:05d}'
                stations.append({
                    'code': station_code,
                    'name': f'{city}{river}{i}站',
                    'city': city,
                    'district': district,
                    'river': river,
                    'longitude': round(118.0 + (idx % 10) * 0.5, 4),
                    'latitude': round(32.0 + (idx % 8) * 0.3, 4)
                })
                idx += 1
        if idx >= 180:
            break

    config = {
        'stations': stations,
        'thresholds': {
            'water_level_jump': 0.5,
            'flow_surge': 200,
            'water_level_min': -999,
            'water_level_max': 9999,
            'flow_min': 0,
            'flow_max': 10000,
            'rainfall_min': 0,
            'rainfall_max': 500
        },
        'database': {
            'path': 'hydro_data.db'
        },
        'logging': {
            'level': 'INFO',
            'file': 'logs/hydro_import.log',
            'max_bytes': 10485760,
            'backup_count': 7
        },
        'deduplication': {
            'strategy': 'skip'
        }
    }

    os.makedirs('config', exist_ok=True)
    with open('config/stations.json', 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

    print(f'生成 {len(stations)} 个站点配置')
    print(f'站点编码范围: {stations[0]["code"]} - {stations[-1]["code"]}')
    return stations


def generate_sample_csv(stations, num_files=5, records_per_file=1000):
    os.makedirs('data', exist_ok=True)
    start_time = datetime(2024, 1, 1, 0, 0)

    for file_idx in range(num_files):
        filename = f'data/sample_batch_{file_idx+1:03d}.csv'
        records = []
        base_time = start_time + timedelta(days=file_idx)

        for i in range(records_per_file):
            station = random.choice(stations)
            obs_time = base_time + timedelta(minutes=i * 10)
            water_level = round(random.uniform(10.0, 30.0), 2)
            flow = round(random.uniform(50, 500), 2)
            rainfall = round(random.uniform(0, 50), 2)

            if random.random() < 0.02:
                water_level += random.choice([-10, 10])
            if random.random() < 0.02:
                flow += random.choice([-300, 500])

            records.append({
                'site_code': station['code'],
                'obs_time': obs_time.strftime('%Y-%m-%d %H:%M'),
                'water_level': water_level,
                'flow': flow,
                'rainfall': rainfall
            })

        if random.random() < 0.3:
            dup_idx = random.randint(0, records_per_file - 1)
            records.append(records[dup_idx].copy())

        if random.random() < 0.1:
            invalid_idx = random.randint(0, len(records) - 1)
            records[invalid_idx]['site_code'] = 'INVALID001'

        if random.random() < 0.1:
            invalid_idx = random.randint(0, len(records) - 1)
            records[invalid_idx]['water_level'] = 'ABC'

        with open(filename, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['site_code', 'obs_time', 'water_level', 'flow', 'rainfall'])
            writer.writeheader()
            writer.writerows(records)

        print(f'生成示例文件: {filename} ({len(records)} 条记录)')


def main():
    random.seed(42)
    stations = generate_station_config()
    generate_sample_csv(stations, num_files=5, records_per_file=1000)
    print('\n配置文件和示例数据生成完成！')


if __name__ == '__main__':
    main()
