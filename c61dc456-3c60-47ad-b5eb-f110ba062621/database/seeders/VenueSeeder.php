<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Venue;
use App\Models\Court;
use App\Models\TimeSlot;
use Carbon\Carbon;

class VenueSeeder extends Seeder
{
    public function run(): void
    {
        $venues = [
            [
                'name' => '中心游泳馆',
                'type' => 'swimming',
                'description' => '标准50米泳池，设有深水区和浅水区，配备专业救生员',
                'address' => '文化路1号',
                'contact_phone' => '12345678900',
                'open_time' => '06:00',
                'close_time' => '22:00',
                'slot_duration' => 90,
                'base_price' => 30.00,
                'peak_price' => 45.00,
                'peak_hours' => json_encode([
                    ['start' => '17:00', 'end' => '22:00'],
                    ['start' => '09:00', 'end' => '11:00'],
                ]),
                'court_count' => 8,
            ],
            [
                'name' => '东馆游泳馆',
                'type' => 'swimming',
                'description' => '室内恒温泳池，适合全年游泳锻炼',
                'address' => '体育路56号',
                'contact_phone' => '12345678901',
                'open_time' => '08:00',
                'close_time' => '21:00',
                'slot_duration' => 90,
                'base_price' => 35.00,
                'peak_price' => 50.00,
                'peak_hours' => json_encode([
                    ['start' => '18:00', 'end' => '21:00'],
                ]),
                'court_count' => 6,
            ],
            [
                'name' => '西馆游泳馆',
                'type' => 'swimming',
                'description' => '儿童戏水区+成人泳道，亲子游泳首选',
                'address' => '幸福街12号',
                'contact_phone' => '12345678902',
                'open_time' => '09:00',
                'close_time' => '20:30',
                'slot_duration' => 60,
                'base_price' => 28.00,
                'peak_price' => 42.00,
                'peak_hours' => json_encode([
                    ['start' => '14:00', 'end' => '18:00'],
                ]),
                'court_count' => 5,
            ],
            [
                'name' => '羽毛球馆',
                'type' => 'badminton',
                'description' => '20片标准羽毛球场地，专业地胶，灯光柔和',
                'address' => '体育馆内',
                'contact_phone' => '12345678903',
                'open_time' => '08:00',
                'close_time' => '22:00',
                'slot_duration' => 60,
                'base_price' => 40.00,
                'peak_price' => 60.00,
                'peak_hours' => json_encode([
                    ['start' => '18:00', 'end' => '22:00'],
                    ['start' => '09:00', 'end' => '11:00'],
                ]),
                'court_count' => 20,
            ],
            [
                'name' => '羽毛球北馆',
                'type' => 'badminton',
                'description' => '10片VIP场地，配备休息区和更衣室',
                'address' => '北区活动中心',
                'contact_phone' => '12345678904',
                'open_time' => '09:00',
                'close_time' => '22:00',
                'slot_duration' => 60,
                'base_price' => 50.00,
                'peak_price' => 75.00,
                'peak_hours' => json_encode([
                    ['start' => '18:00', 'end' => '22:00'],
                ]),
                'court_count' => 10,
            ],
            [
                'name' => '篮球馆',
                'type' => 'basketball',
                'description' => '2片标准全场，4个半场，专业木地板',
                'address' => '体育中心',
                'contact_phone' => '12345678905',
                'open_time' => '09:00',
                'close_time' => '22:00',
                'slot_duration' => 60,
                'base_price' => 80.00,
                'peak_price' => 120.00,
                'peak_hours' => json_encode([
                    ['start' => '18:00', 'end' => '22:00'],
                    ['start' => '14:00', 'end' => '17:00'],
                ]),
                'court_count' => 6,
            ],
            [
                'name' => '网球馆',
                'type' => 'tennis',
                'description' => '4片室内硬地网球场，满足专业训练和比赛',
                'address' => '网球中心',
                'contact_phone' => '12345678906',
                'open_time' => '08:00',
                'close_time' => '21:00',
                'slot_duration' => 60,
                'base_price' => 100.00,
                'peak_price' => 150.00,
                'peak_hours' => json_encode([
                    ['start' => '16:00', 'end' => '21:00'],
                ]),
                'court_count' => 4,
            ],
            [
                'name' => '乒乓球馆',
                'type' => 'table_tennis',
                'description' => '30张标准乒乓球台，红双喜品牌',
                'address' => '全民健身中心',
                'contact_phone' => '12345678907',
                'open_time' => '08:00',
                'close_time' => '22:00',
                'slot_duration' => 60,
                'base_price' => 15.00,
                'peak_price' => 25.00,
                'peak_hours' => json_encode([
                    ['start' => '19:00', 'end' => '22:00'],
                ]),
                'court_count' => 30,
            ],
        ];

        foreach ($venues as $venueData) {
            $courtCount = $venueData['court_count'];
            unset($venueData['court_count']);

            $venue = Venue::create($venueData);

            for ($i = 1; $i <= $courtCount; $i++) {
                Court::create([
                    'venue_id' => $venue->id,
                    'name' => sprintf('%d号场地', $i),
                    'court_number' => sprintf('%02d', $i),
                    'is_active' => true,
                ]);
            }

            $this->generateTimeSlots($venue, $courtCount);
        }
    }

    protected function generateTimeSlots(Venue $venue, int $courtCount): void
    {
        $openTime = Carbon::parse($venue->open_time);
        $closeTime = Carbon::parse($venue->close_time);
        $duration = $venue->slot_duration;
        $peakHours = $venue->getPeakHoursArray();

        $current = clone $openTime;
        $slots = [];

        while ($current->lt($closeTime)) {
            $end = (clone $current)->addMinutes($duration);
            if ($end->gt($closeTime)) {
                break;
            }

            $isPeak = false;
            foreach ($peakHours as $range) {
                if ($current->format('H:i') >= $range['start'] && $current->format('H:i') < $range['end']) {
                    $isPeak = true;
                    break;
                }
            }

            $price = $isPeak ? $venue->peak_price : $venue->base_price;

            for ($day = 0; $day < $venue->advance_booking_days; $day++) {
                $date = Carbon::today()->addDays($day)->format('Y-m-d');

                TimeSlot::create([
                    'venue_id' => $venue->id,
                    'date' => $date,
                    'start_time' => $current->format('H:i'),
                    'end_time' => $end->format('H:i'),
                    'total_courts' => $courtCount,
                    'booked_courts' => 0,
                    'price' => $price,
                    'is_peak' => $isPeak,
                    'is_active' => true,
                ]);
            }

            $current = $end;
        }
    }
}
