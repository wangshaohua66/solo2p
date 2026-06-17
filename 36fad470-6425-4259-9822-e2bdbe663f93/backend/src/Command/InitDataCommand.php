<?php

namespace App\Command;

use App\Document\Device;
use App\Document\DeviceRequirement;
use App\Document\Performance;
use App\Document\SeatSection;
use App\Document\User;
use App\Document\Venue;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

#[AsCommand(
    name: 'app:init-data',
    description: '初始化系统演示数据'
)]
class InitDataCommand extends Command
{
    private DocumentManager $dm;
    private UserPasswordHasherInterface $passwordHasher;

    public function __construct(DocumentManager $dm, UserPasswordHasherInterface $passwordHasher)
    {
        parent::__construct();
        $this->dm = $dm;
        $this->passwordHasher = $passwordHasher;
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $io->title('正在初始化系统演示数据...');

        $this->createUsers($io);
        $this->createVenues($io);
        $this->createDevices($io);
        $this->createSamplePerformances($io);

        $this->dm->flush();

        $io->success('数据初始化完成！');
        $io->table(
            ['账号类型', '用户名', '密码', '角色'],
            [
                ['场馆管理员', 'admin', 'admin123', 'venue_admin'],
                ['演出主办方', 'organizer', 'organizer123', 'organizer'],
                ['财务人员', 'finance', 'finance123', 'finance'],
                ['观众用户', 'audience', 'audience123', 'audience'],
            ]
        );

        return Command::SUCCESS;
    }

    private function createUsers(SymfonyStyle $io): void
    {
        $users = [
            [
                'username' => 'admin',
                'password' => 'admin123',
                'name' => '张管理',
                'email' => 'admin@theater.com',
                'phone' => '13800138001',
                'role' => User::ROLE_VENUE_ADMIN
            ],
            [
                'username' => 'organizer',
                'password' => 'organizer123',
                'name' => '李主办',
                'email' => 'organizer@theater.com',
                'phone' => '13800138002',
                'role' => User::ROLE_ORGANIZER
            ],
            [
                'username' => 'finance',
                'password' => 'finance123',
                'name' => '王财务',
                'email' => 'finance@theater.com',
                'phone' => '13800138003',
                'role' => User::ROLE_FINANCE
            ],
            [
                'username' => 'audience',
                'password' => 'audience123',
                'name' => '赵观众',
                'email' => 'audience@example.com',
                'phone' => '13800138004',
                'role' => User::ROLE_AUDIENCE
            ],
        ];

        foreach ($users as $userData) {
            $existing = $this->dm->getRepository(User::class)->findOneBy(['username' => $userData['username']]);
            if ($existing) {
                $io->note(sprintf('用户 %s 已存在，跳过', $userData['username']));
                continue;
            }

            $user = new User();
            $user->setUsername($userData['username']);
            $user->setName($userData['name']);
            $user->setEmail($userData['email']);
            $user->setPhone($userData['phone']);
            $user->setRole($userData['role']);
            $user->setPassword($this->passwordHasher->hashPassword($user, $userData['password']));

            $this->dm->persist($user);
            $io->text(sprintf('✓ 创建用户: %s (%s)', $userData['name'], $userData['role']));
        }
    }

    private function createVenues(SymfonyStyle $io): void
    {
        $venuesData = [
            [
                'name' => '大剧院',
                'type' => Venue::TYPE_GRAND_THEATER,
                'totalSeats' => 2000,
                'description' => '专业大型演出场馆，适用于话剧、音乐剧、大型歌舞等演出',
                'sections' => [
                    ['name' => '池座A区', 'type' => SeatSection::TYPE_POOL, 'rows' => 20, 'cols' => 30, 'price' => 680, 'startRow' => 1, 'startCol' => 1],
                    ['name' => '池座B区', 'type' => SeatSection::TYPE_POOL, 'rows' => 15, 'cols' => 30, 'price' => 480, 'startRow' => 21, 'startCol' => 1],
                    ['name' => '楼座', 'type' => SeatSection::TYPE_BALCONY, 'rows' => 15, 'cols' => 30, 'price' => 280, 'startRow' => 1, 'startCol' => 1, 'disabled' => [Performance::TYPE_CONCERT]],
                    ['name' => 'VIP包厢', 'type' => SeatSection::TYPE_BOX, 'rows' => 5, 'cols' => 8, 'price' => 1280, 'startRow' => 1, 'startCol' => 1],
                ]
            ],
            [
                'name' => '音乐厅',
                'type' => Venue::TYPE_CONCERT_HALL,
                'totalSeats' => 1500,
                'description' => '专业古典音乐演奏场馆，自然声学设计',
                'sections' => [
                    ['name' => 'VIP区', 'type' => SeatSection::TYPE_POOL, 'rows' => 12, 'cols' => 25, 'price' => 880, 'startRow' => 1, 'startCol' => 1],
                    ['name' => 'A区', 'type' => SeatSection::TYPE_POOL, 'rows' => 15, 'cols' => 25, 'price' => 580, 'startRow' => 13, 'startCol' => 1],
                    ['name' => 'B区', 'type' => SeatSection::TYPE_POOL, 'rows' => 10, 'cols' => 25, 'price' => 380, 'startRow' => 28, 'startCol' => 1],
                    ['name' => 'C区(后排)', 'type' => SeatSection::TYPE_BALCONY, 'rows' => 10, 'cols' => 25, 'price' => 180, 'startRow' => 1, 'startCol' => 1, 'disabled' => [Performance::TYPE_CONCERT]],
                ]
            ],
            [
                'name' => '小剧场',
                'type' => Venue::TYPE_SMALL_THEATER,
                'totalSeats' => 1000,
                'description' => '小型实验剧场，适用于儿童剧、小剧场话剧、实验演出',
                'sections' => [
                    ['name' => '观众席A', 'type' => SeatSection::TYPE_POOL, 'rows' => 18, 'cols' => 28, 'price' => 280, 'startRow' => 1, 'startCol' => 1],
                    ['name' => '观众席B', 'type' => SeatSection::TYPE_POOL, 'rows' => 10, 'cols' => 28, 'price' => 180, 'startRow' => 19, 'startCol' => 1],
                    ['name' => '侧翼', 'type' => SeatSection::TYPE_SIDE, 'rows' => 8, 'cols' => 10, 'price' => 120, 'startRow' => 1, 'startCol' => 1, 'disabled' => [Performance::TYPE_DRAMA]],
                ]
            ]
        ];

        foreach ($venuesData as $venueData) {
            $existing = $this->dm->getRepository(Venue::class)->findOneBy(['name' => $venueData['name']]);
            if ($existing) {
                $io->note(sprintf('场馆 %s 已存在，跳过', $venueData['name']));
                continue;
            }

            $venue = new Venue();
            $venue->setName($venueData['name']);
            $venue->setType($venueData['type']);
            $venue->setTotalSeats($venueData['totalSeats']);
            $venue->setDescription($venueData['description']);

            foreach ($venueData['sections'] as $sectionData) {
                $section = new SeatSection();
                $section->setName($sectionData['name']);
                $section->setType($sectionData['type']);
                $section->setRows($sectionData['rows']);
                $section->setColumns($sectionData['cols']);
                $section->setStartRow($sectionData['startRow']);
                $section->setStartColumn($sectionData['startCol']);
                $section->setBasePrice($sectionData['price']);
                $section->setNumberingRule(SeatSection::NUMBERING_ROW_BASED);
                if (isset($sectionData['disabled'])) {
                    $section->setDisabledForTypes($sectionData['disabled']);
                }
                $venue->addSeatConfig($section);
            }

            $this->dm->persist($venue);
            $io->text(sprintf('✓ 创建场馆: %s (%d座)', $venueData['name'], $venueData['totalSeats']));
        }
    }

    private function createDevices(SymfonyStyle $io): void
    {
        $devicesData = [
            ['name' => '230W摇头光束灯', 'category' => Device::CATEGORY_LIGHTING, 'spec' => '230W 7R Osram', 'qty' => 48],
            ['name' => 'LED帕灯', 'category' => Device::CATEGORY_LIGHTING, 'spec' => '54×3W RGBW', 'qty' => 80],
            ['name' => '追光灯', 'category' => Device::CATEGORY_LIGHTING, 'spec' => '2500W HMI', 'qty' => 4],
            ['name' => 'LED染色灯', 'category' => Device::CATEGORY_LIGHTING, 'spec' => '19×15W 蜂眼', 'qty' => 24],
            ['name' => '频闪灯', 'category' => Device::CATEGORY_LIGHTING, 'spec' => '3000W', 'qty' => 8],
            ['name' => '烟雾机', 'category' => Device::CATEGORY_LIGHTING, 'spec' => '1500W 双管', 'qty' => 6],
            ['name' => '全频主音箱', 'category' => Device::CATEGORY_SOUND, 'spec' => 'JBL VT4888', 'qty' => 16],
            ['name' => '超低频音箱', 'category' => Device::CATEGORY_SOUND, 'spec' => 'JBL VT4882', 'qty' => 8],
            ['name' => '返听音箱', 'category' => Device::CATEGORY_SOUND, 'spec' => 'JBL SRX812', 'qty' => 12],
            ['name' => '无线手持话筒', 'category' => Device::CATEGORY_SOUND, 'spec' => 'Shure SLX24/SM58', 'qty' => 24],
            ['name' => '无线头戴话筒', 'category' => Device::CATEGORY_SOUND, 'spec' => 'Shure SLX14/WH30', 'qty' => 16],
            ['name' => '数字调音台', 'category' => Device::CATEGORY_SOUND, 'spec' => 'Yamaha CL5', 'qty' => 2],
            ['name' => '功放', 'category' => Device::CATEGORY_SOUND, 'spec' => 'Crown I-Tech 4x3500HD', 'qty' => 10],
            ['name' => '铝合金移动平台', 'category' => Device::CATEGORY_STAGE, 'spec' => '2m×1m 可调高度', 'qty' => 40],
            ['name' => '背景桁架', 'category' => Device::CATEGORY_STAGE, 'spec' => '400×400mm 铝合金', 'qty' => 200],
            ['name' => 'LED大屏', 'category' => Device::CATEGORY_STAGE, 'spec' => 'P3.91 500×500mm', 'qty' => 100],
            ['name' => '投影幕布', 'category' => Device::CATEGORY_STAGE, 'spec' => '200寸电动', 'qty' => 4],
            ['name' => '乐池升降台', 'category' => Device::CATEGORY_STAGE, 'spec' => '定制', 'qty' => 1],
        ];

        foreach ($devicesData as $deviceData) {
            $existing = $this->dm->getRepository(Device::class)->findOneBy(['name' => $deviceData['name']]);
            if ($existing) {
                continue;
            }

            $device = new Device();
            $device->setName($deviceData['name']);
            $device->setCategory($deviceData['category']);
            $device->setSpecification($deviceData['spec']);
            $device->setQuantity($deviceData['qty']);
            $device->setAvailableQuantity($deviceData['qty']);
            $device->setStatus(Device::STATUS_AVAILABLE);

            $this->dm->persist($device);
        }

        $io->text(sprintf('✓ 创建设备: %d 项', count($devicesData)));
    }

    private function createSamplePerformances(SymfonyStyle $io): void
    {
        $adminUser = $this->dm->getRepository(User::class)->findOneBy(['username' => 'admin']);
        $organizerUser = $this->dm->getRepository(User::class)->findOneBy(['username' => 'organizer']);
        if (!$organizerUser || !$adminUser) {
            return;
        }

        $venueRepo = $this->dm->getRepository(Venue::class);
        $grandTheater = $venueRepo->findOneBy(['name' => '大剧院']);
        $concertHall = $venueRepo->findOneBy(['name' => '音乐厅']);
        $smallTheater = $venueRepo->findOneBy(['name' => '小剧场']);

        $performances = [];

        if ($grandTheater) {
            $perf1 = new Performance();
            $perf1->setName('《雷雨》经典话剧');
            $perf1->setType(Performance::TYPE_DRAMA);
            $perf1->setOrganizer($organizerUser);
            $perf1->setOrganizerName($organizerUser->getName());
            $perf1->setVenue($grandTheater);
            $perf1->setVenueName($grandTheater->getName());
            $perf1->setExpectedDuration(150);
            $perf1->setTechnicalRequirements(['basic_light', 'professional_sound', 'microphone_wireless']);
            $perf1->setExpectedDates([
                (new \DateTime('+7 days'))->format('Y-m-d'),
                (new \DateTime('+8 days'))->format('Y-m-d'),
            ]);
            $perf1->setStartTime((new \DateTime('+7 days'))->setTime(19, 30));
            $perf1->setEndTime((new \DateTime('+7 days'))->setTime(22, 0));
            $perf1->setStatus(Performance::STATUS_APPROVED);
            $perf1->setApprovedAt(new \DateTime());
            $this->dm->persist($perf1);
            $performances[] = $perf1;

            $perf2 = new Performance();
            $perf2->setName('天鹅湖芭蕾舞');
            $perf2->setType(Performance::TYPE_DANCE);
            $perf2->setOrganizer($organizerUser);
            $perf2->setOrganizerName($organizerUser->getName());
            $perf2->setVenue($grandTheater);
            $perf2->setVenueName($grandTheater->getName());
            $perf2->setExpectedDuration(180);
            $perf2->setTechnicalRequirements(['professional_light', 'professional_sound', 'orchestra_pit']);
            $perf2->setExpectedDates([(new \DateTime('+14 days'))->format('Y-m-d')]);
            $perf2->setStartTime((new \DateTime('+14 days'))->setTime(19, 0));
            $perf2->setEndTime((new \DateTime('+14 days'))->setTime(22, 0));
            $perf2->setStatus(Performance::STATUS_APPROVED);
            $perf2->setApprovedAt(new \DateTime());
            $this->dm->persist($perf2);
            $performances[] = $perf2;
        }

        if ($concertHall) {
            $perf3 = new Performance();
            $perf3->setName('新年交响音乐会');
            $perf3->setType(Performance::TYPE_CONCERT);
            $perf3->setOrganizer($organizerUser);
            $perf3->setOrganizerName($organizerUser->getName());
            $perf3->setVenue($concertHall);
            $perf3->setVenueName($concertHall->getName());
            $perf3->setExpectedDuration(120);
            $perf3->setTechnicalRequirements(['basic_sound', 'orchestra_pit']);
            $perf3->setExpectedDates([(new \DateTime('+10 days'))->format('Y-m-d')]);
            $perf3->setStartTime((new \DateTime('+10 days'))->setTime(19, 30));
            $perf3->setEndTime((new \DateTime('+10 days'))->setTime(21, 30));
            $perf3->setStatus(Performance::STATUS_APPROVED);
            $perf3->setApprovedAt(new \DateTime());
            $this->dm->persist($perf3);
            $performances[] = $perf3;
        }

        if ($smallTheater) {
            $perf4 = new Performance();
            $perf4->setName('儿童剧《白雪公主》');
            $perf4->setType(Performance::TYPE_CHILDREN);
            $perf4->setOrganizer($organizerUser);
            $perf4->setOrganizerName($organizerUser->getName());
            $perf4->setVenue($smallTheater);
            $perf4->setVenueName($smallTheater->getName());
            $perf4->setExpectedDuration(90);
            $perf4->setTechnicalRequirements(['basic_light', 'basic_sound', 'led_screen']);
            $perf4->setExpectedDates([(new \DateTime('+5 days'))->format('Y-m-d')]);
            $perf4->setStartTime((new \DateTime('+5 days'))->setTime(14, 0));
            $perf4->setEndTime((new \DateTime('+5 days'))->setTime(15, 30));
            $perf4->setStatus(Performance::STATUS_PENDING);
            $this->dm->persist($perf4);
            $performances[] = $perf4;
        }

        $io->text(sprintf('✓ 创建示例演出: %d 场', count($performances)));
    }
}
