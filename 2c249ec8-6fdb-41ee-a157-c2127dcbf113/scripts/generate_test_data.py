#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import argparse
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def generate_solar_data(start_date, days=365, capacity=50, noise_level=0.1, seed=42):
    np.random.seed(seed)
    
    dates = pd.date_range(start=start_date, periods=days * 24, freq='h')
    
    hour = dates.hour.values
    dayofyear = dates.dayofyear.values
    
    solar_factor = np.maximum(0, np.sin((hour - 6) / 12 * np.pi))
    
    seasonal_factor = 0.5 + 0.5 * np.sin(2 * np.pi * (dayofyear - 80) / 365)
    
    base_power = capacity * solar_factor * seasonal_factor
    
    noise = np.random.normal(0, noise_level * capacity, len(dates))
    power = np.maximum(0, base_power + noise)
    
    temperature = 15 + 15 * np.sin(2 * np.pi * (dayofyear - 80) / 365) + 5 * np.sin((hour - 6) / 12 * np.pi)
    temperature += np.random.normal(0, 2, len(dates))
    
    humidity = 60 + 20 * np.cos(2 * np.pi * (dayofyear - 80) / 365) - 10 * solar_factor
    humidity += np.random.normal(0, 5, len(dates))
    humidity = np.clip(humidity, 10, 100)
    
    solar_radiation = 1000 * solar_factor * seasonal_factor
    solar_radiation += np.random.normal(0, 50, len(dates))
    solar_radiation = np.maximum(0, solar_radiation)
    
    df = pd.DataFrame({
        'timestamp': dates,
        'power': power.round(2),
        'temperature': temperature.round(2),
        'humidity': humidity.round(2),
        'solar_radiation': solar_radiation.round(2),
    })
    
    return df


def generate_wind_data(start_date, days=365, capacity=100, noise_level=0.2, seed=42):
    np.random.seed(seed)
    
    dates = pd.date_range(start=start_date, periods=days * 24, freq='h')
    
    hour = dates.hour.values
    dayofyear = dates.dayofyear.values
    
    base_wind_speed = 8 + 4 * np.sin(2 * np.pi * (dayofyear - 30) / 365)
    base_wind_speed += 2 * np.sin((hour + 12) / 12 * np.pi)
    base_wind_speed += np.random.normal(0, 3, len(dates))
    base_wind_speed = np.maximum(0, base_wind_speed)
    
    cut_in = 3
    rated_speed = 12
    cut_out = 25
    
    power = np.zeros(len(dates))
    mask_rated = base_wind_speed >= rated_speed
    mask_between = (base_wind_speed >= cut_in) & (base_wind_speed < rated_speed)
    
    power[mask_rated] = capacity
    power[mask_between] = capacity * ((base_wind_speed[mask_between] - cut_in) / (rated_speed - cut_in)) ** 3
    power[base_wind_speed > cut_out] = 0
    
    noise = np.random.normal(0, noise_level * capacity, len(dates))
    power = np.maximum(0, power + noise)
    
    temperature = 12 + 10 * np.sin(2 * np.pi * (dayofyear - 80) / 365)
    temperature += np.random.normal(0, 3, len(dates))
    
    pressure = 1013 + 5 * np.sin(2 * np.pi * (dayofyear - 180) / 365)
    pressure += np.random.normal(0, 2, len(dates))
    
    df = pd.DataFrame({
        'timestamp': dates,
        'power': power.round(2),
        'wind_speed': base_wind_speed.round(2),
        'temperature': temperature.round(2),
        'pressure': pressure.round(2),
    })
    
    return df


def main():
    parser = argparse.ArgumentParser(description='生成测试数据')
    parser.add_argument('--type', '-t', type=str, default='solar', choices=['solar', 'wind'],
                         help='电站类型')
    parser.add_argument('--output', '-o', type=str, required=True, help='输出文件路径')
    parser.add_argument('--days', '-d', type=int, default=365, help='生成天数')
    parser.add_argument('--capacity', '-c', type=float, default=50, help='装机容量 (MW)')
    parser.add_argument('--start-date', type=str, default='2023-01-01', help='开始日期')
    
    args = parser.parse_args()
    
    if args.type == 'solar':
        df = generate_solar_data(args.start_date, days=args.days, capacity=args.capacity)
    else:
        df = generate_wind_data(args.start_date, days=args.days, capacity=args.capacity)
    
    os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else '.', exist_ok=True)
    
    if args.output.endswith('.xlsx') or args.output.endswith('.xls'):
        df.to_excel(args.output, index=False, engine='openpyxl')
    elif args.output.endswith('.json'):
        df.to_json(args.output, orient='records', force_ascii=False, indent=2)
    else:
        df.to_csv(args.output, index=False)
    
    print(f"已生成 {len(df)} 条数据，保存到: {args.output}")
    print(f"时间范围: {df['timestamp'].min()} ~ {df['timestamp'].max()}")
    print(f"平均功率: {df['power'].mean():.2f} MW")
    print(f"最大功率: {df['power'].max():.2f} MW")


if __name__ == '__main__':
    main()
