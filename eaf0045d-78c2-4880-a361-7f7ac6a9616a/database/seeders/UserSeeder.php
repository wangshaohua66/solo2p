<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            [
                'username' => 'admin',
                'name' => '系统管理员',
                'email' => 'admin@example.com',
                'password' => Hash::make('password123'),
                'phone' => '13800000000',
                'company_name' => '电力交易中心',
                'role' => 'exchange',
            ],
            [
                'username' => 'regulator',
                'name' => '监管人员',
                'email' => 'regulator@example.com',
                'password' => Hash::make('password123'),
                'phone' => '13800000001',
                'company_name' => '能源监管局',
                'role' => 'regulator',
            ],
            [
                'username' => 'generator1',
                'name' => '阳光光伏电站',
                'email' => 'generator1@example.com',
                'password' => Hash::make('password123'),
                'phone' => '13800000002',
                'company_name' => '阳光新能源有限公司',
                'role' => 'generator',
            ],
            [
                'username' => 'generator2',
                'name' => '大风风电场',
                'email' => 'generator2@example.com',
                'password' => Hash::make('password123'),
                'phone' => '13800000003',
                'company_name' => '大风能源集团',
                'role' => 'generator',
            ],
            [
                'username' => 'purchaser1',
                'name' => '绿色制造公司',
                'email' => 'purchaser1@example.com',
                'password' => Hash::make('password123'),
                'phone' => '13800000004',
                'company_name' => '绿色制造股份有限公司',
                'role' => 'purchaser',
            ],
            [
                'username' => 'purchaser2',
                'name' => '环保科技公司',
                'email' => 'purchaser2@example.com',
                'password' => Hash::make('password123'),
                'phone' => '13800000005',
                'company_name' => '环保科技有限公司',
                'role' => 'purchaser',
            ],
        ];

        foreach ($users as $user) {
            User::firstOrCreate(
                ['username' => $user['username']],
                $user
            );
        }
    }
}
