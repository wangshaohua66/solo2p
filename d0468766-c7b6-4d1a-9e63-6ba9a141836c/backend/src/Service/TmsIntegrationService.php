<?php

namespace App\Service;

use Symfony\Contracts\HttpClient\HttpClientInterface;

readonly class TmsIntegrationService
{
    public const VENDOR_GDC = 'gdc';
    public const VENDOR_BARCO = 'barco';
    public const VENDOR_CHENXING = 'chenxing';
    public const VENDOR_HUOLIE = 'huolie';

    private array $vendorConfigs = [
        self::VENDOR_GDC => [
            'name' => 'GDC',
            'baseUrl' => 'https://gdc-tms.example.com/api/v1',
            'apiKey' => '',
        ],
        self::VENDOR_BARCO => [
            'name' => '巴可 Barco',
            'baseUrl' => 'https://barco-tms.example.com/api',
            'apiKey' => '',
        ],
        self::VENDOR_CHENXING => [
            'name' => '辰星',
            'baseUrl' => 'https://chenxing-tms.example.com/v1',
            'apiKey' => '',
        ],
        self::VENDOR_HUOLIE => [
            'name' => '火烈鸟',
            'baseUrl' => 'https://huolie-tms.example.com/api',
            'apiKey' => '',
        ],
    ];

    public function __construct(private HttpClientInterface $httpClient)
    {
    }

    public function getSupportedVendors(): array
    {
        $vendors = [];
        foreach ($this->vendorConfigs as $key => $config) {
            $vendors[] = [
                'vendor' => $key,
                'name' => $config['name'],
                'baseUrl' => $config['baseUrl'],
            ];
        }
        return $vendors;
    }

    public function getDevices(string $cinemaId, string $vendor = self::VENDOR_GDC): array
    {
        return $this->mockDevices($cinemaId);
    }

    public function getDeviceStatus(string $cinemaId, string $deviceId, string $vendor = self::VENDOR_GDC): array
    {
        return [
            'deviceId' => $deviceId,
            'cinemaId' => $cinemaId,
            'vendor' => $vendor,
            'status' => 'online',
            'model' => 'GDC SX-4000',
            'firmware' => 'v4.2.1',
            'serialNo' => 'GDC' . strtoupper(substr(md5($deviceId), 0, 12)),
            'lastHeartbeat' => (new \DateTimeImmutable('-30 seconds'))->format(\DateTimeInterface::ATOM),
            'temperature' => 42.5,
            'uptimeHours' => 2340,
            'storage' => [
                'totalGB' => 8000,
                'usedGB' => 5200,
                'freeGB' => 2800,
            ],
            'components' => [
                'projector' => 'online',
                'server' => 'online',
                'audio' => 'online',
                'lamp' => 'normal',
                'lampHours' => 860,
                'lampLifeHours' => 2000,
            ],
            'alerts' => [],
        ];
    }

    public function getKdmList(string $cinemaId, string $vendor = self::VENDOR_GDC): array
    {
        $movies = [
            ['movieId' => 'mv_f', 'name' => '复仇者联盟5：秘密战争', 'daysLeft' => 45],
            ['movieId' => 'mv_f2', 'name' => '阿凡达3', 'daysLeft' => 30],
            ['movieId' => 'mv_f3', 'name' => '流浪地球3', 'daysLeft' => 60],
        ];
        $result = [];
        foreach ($movies as $m) {
            $result[] = [
                'kdmId' => 'kdm_' . $m['movieId'] . '_' . $cinemaId,
                'cinemaId' => $cinemaId,
                'movieId' => $m['movieId'],
                'movieName' => $m['name'],
                'vendor' => $vendor,
                'issuedAt' => (new \DateTimeImmutable('-7 days'))->format(\DateTimeInterface::ATOM),
                'validFrom' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
                'validUntil' => (new \DateTimeImmutable('+' . $m['daysLeft'] . ' days'))->format(\DateTimeInterface::ATOM),
                'daysLeft' => $m['daysLeft'],
                'status' => 'active',
            ];
        }
        return $result;
    }

    public function getPlaylists(string $cinemaId, string $vendor = self::VENDOR_GDC): array
    {
        $halls = ['1号厅', '2号厅', '3号厅', 'IMAX厅', '杜比厅'];
        $movies = [
            '复仇者联盟5：秘密战争' => 150,
            '阿凡达3' => 180,
            '流浪地球3' => 170,
            '你好，少年' => 120,
            '星际远征' => 140,
            '夏日协奏曲' => 110,
        ];
        $pls = [];
        foreach ($movies as $name => $dur) {
            $pls[] = [
                'playlistId' => 'pl_' . md5($name . $cinemaId),
                'cinemaId' => $cinemaId,
                'movieName' => $name,
                'duration' => $dur,
                'vendor' => $vendor,
                'version' => rand(0, 1) ? '2D国语' : '3D原版',
                'sizeMB' => rand(80000, 250000),
                'createdAt' => (new \DateTimeImmutable('-30 days'))->format(\DateTimeInterface::ATOM),
                'availableAt' => $halls[array_rand($halls)],
                'status' => 'ready',
            ];
        }
        return $pls;
    }

    public function getSessions(string $cinemaId, string $vendor = self::VENDOR_GDC, ?string $date = null): array
    {
        $date = $date ?? date('Y-m-d');
        $halls = [
            ['id' => 'hall_1', 'name' => '1号厅', 'type' => '标准厅', 'seats' => 120],
            ['id' => 'hall_2', 'name' => '2号厅', 'type' => '标准厅', 'seats' => 120],
            ['id' => 'hall_i', 'name' => 'IMAX厅', 'type' => 'IMAX厅', 'seats' => 280],
        ];
        $movies = [
            ['id' => 'mv_f', 'name' => '复仇者联盟5：秘密战争', 'dur' => 150],
            ['id' => 'mv_f2', 'name' => '阿凡达3', 'dur' => 180],
            ['id' => 'mv_f3', 'name' => '流浪地球3', 'dur' => 170],
        ];
        $times = ['09:30', '12:00', '14:30', '17:00', '19:30', '22:00'];

        $sessions = [];
        foreach ($halls as $h) {
            foreach ($times as $idx => $t) {
                $m = $movies[$idx % count($movies)];
                $start = new \DateTimeImmutable($date . ' ' . $t);
                $end = $start->add(new \DateInterval('PT' . $m['dur'] . 'M'));
                $sessions[] = [
                    'sessionId' => 'tms_' . $cinemaId . '_' . $h['id'] . '_' . $t,
                    'cinemaId' => $cinemaId,
                    'vendor' => $vendor,
                    'hallId' => $h['id'],
                    'hallName' => $h['name'],
                    'hallType' => $h['type'],
                    'movieId' => $m['id'],
                    'movieName' => $m['name'],
                    'date' => $date,
                    'startTime' => $t,
                    'endTime' => $end->format('H:i'),
                    'duration' => $m['dur'],
                    'tmsStatus' => 'scheduled',
                    'playlistId' => 'pl_' . md5($m['name'] . $cinemaId),
                    'seatsTotal' => $h['seats'],
                ];
            }
        }
        return $sessions;
    }

    public function getAlarms(string $cinemaId, string $vendor = self::VENDOR_GDC): array
    {
        return [
            [
                'alarmId' => 'alarm_' . $cinemaId . '_1',
                'cinemaId' => $cinemaId,
                'vendor' => $vendor,
                'hallName' => '3号厅',
                'device' => '放映机',
                'severity' => 'warning',
                'code' => 'LAMP_HOURS_HIGH',
                'message' => '灯泡寿命剩余 15%，建议近期更换',
                'timestamp' => (new \DateTimeImmutable('-2 hours'))->format(\DateTimeInterface::ATOM),
                'acknowledged' => false,
            ],
            [
                'alarmId' => 'alarm_' . $cinemaId . '_2',
                'cinemaId' => $cinemaId,
                'vendor' => $vendor,
                'hallName' => 'IMAX厅',
                'device' => '服务器',
                'severity' => 'info',
                'code' => 'STORAGE_HIGH',
                'message' => '存储空间使用率已达 78%',
                'timestamp' => (new \DateTimeImmutable('-5 hours'))->format(\DateTimeInterface::ATOM),
                'acknowledged' => true,
            ],
        ];
    }

    public function getQualityReport(string $cinemaId, string $date, string $vendor = self::VENDOR_GDC): array
    {
        $halls = ['1号厅', '2号厅', '3号厅', 'IMAX厅', '杜比厅'];
        $reports = [];
        foreach ($halls as $h) {
            $reports[] = [
                'hallName' => $h,
                'date' => $date,
                'sessionsChecked' => rand(3, 6),
                'overallScore' => rand(88, 98) / 10,
                'pictureQuality' => rand(85, 100) / 10,
                'soundQuality' => rand(85, 100) / 10,
                'projectionStability' => rand(90, 100) / 10,
                'frameDrops' => rand(0, 5),
                'audioGlitches' => rand(0, 2),
                'issues' => [],
            ];
        }
        return [
            'cinemaId' => $cinemaId,
            'vendor' => $vendor,
            'date' => $date,
            'halls' => $reports,
            'averageScore' => array_sum(array_column($reports, 'overallScore')) / count($reports),
        ];
    }

    private function mockDevices(string $cinemaId): array
    {
        $halls = ['1号厅', '2号厅', '3号厅', 'IMAX厅', '杜比厅'];
        $devices = [];
        foreach ($halls as $idx => $h) {
            $devices[] = [
                'deviceId' => 'dev_' . $cinemaId . '_' . ($idx + 1),
                'cinemaId' => $cinemaId,
                'hallName' => $h,
                'type' => $idx === 3 ? 'IMAX服务器' : ($idx === 4 ? '杜比服务器' : 'GDC SX-4000'),
                'model' => 'GDC SX-4000',
                'status' => $idx === 2 ? 'warning' : 'online',
                'ip' => '192.168.1.' . (100 + $idx),
                'serialNo' => 'GDC' . strtoupper(substr(md5($cinemaId . $idx), 0, 10)),
                'firmware' => 'v4.2.1',
            ];
        }
        return $devices;
    }
}
