<?php

namespace Database\Seeders;

use App\Models\PowerStation;
use App\Models\User;
use Illuminate\Database\Seeder;

class PowerStationSeeder extends Seeder
{
    public function run(): void
    {
        $generator1 = User::where('username', 'generator1')->first();
        $generator2 = User::where('username', 'generator2')->first();

        $stations = [
            [
                'station_code' => 'SOL-001',
                'station_name' => '阳光一号光伏电站',
                'energy_type' => 'solar',
                'installed_capacity' => 10000,
                'province' => '江苏省',
                'city' => '南京市',
                'address' => '南京市江宁区光伏产业园',
                'owner_id' => $generator1?->id,
                'grid_connection_date' => '2022-06-01',
            ],
            [
                'station_code' => 'SOL-002',
                'station_name' => '阳光二号光伏电站',
                'energy_type' => 'solar',
                'installed_capacity' => 15000,
                'province' => '浙江省',
                'city' => '杭州市',
                'address' => '杭州市余杭区太阳能基地',
                'owner_id' => $generator1?->id,
                'grid_connection_date' => '2023-03-15',
            ],
            [
                'station_code' => 'WIN-001',
                'station_name' => '大风一号风电场',
                'energy_type' => 'wind',
                'installed_capacity' => 20000,
                'province' => '内蒙古自治区',
                'city' => '呼和浩特市',
                'address' => '呼和浩特市武川县风电场',
                'owner_id' => $generator2?->id,
                'grid_connection_date' => '2021-09-01',
            ],
            [
                'station_code' => 'WIN-002',
                'station_name' => '大风二号风电场',
                'energy_type' => 'wind',
                'installed_capacity' => 25000,
                'province' => '新疆维吾尔自治区',
                'city' => '乌鲁木齐市',
                'address' => '乌鲁木齐市达坂城区风电场',
                'owner_id' => $generator2?->id,
                'grid_connection_date' => '2022-12-20',
            ],
        ];

        foreach ($stations as $station) {
            PowerStation::firstOrCreate(
                ['station_code' => $station['station_code']],
                $station
            );
        }
    }
}
