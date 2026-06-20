<?php

namespace App\Command;

use App\Entity\Booth;
use App\Entity\Contract;
use App\Entity\ContractLog;
use App\Entity\Exhibition;
use App\Entity\Exhibitor;
use App\Entity\SatisfactionSurvey;
use App\Entity\ServiceOrder;
use App\Entity\ServiceProvider;
use App\Entity\Visitor;
use App\Service\CacheService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:seed', description: '生成会展中心演示数据并预热 Redis 缓存')]
class SeedCommand extends Command
{
    public function __construct(private readonly EntityManagerInterface $em, private readonly CacheService $cache)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        mt_srand(2025);

        $this->truncate($io);
        $exhibitions = $this->seedExhibitions();
        $exhibitors = $this->seedExhibitors();
        $providers = $this->seedProviders();

        $stats = ['booths' => 0, 'contracts' => 0, 'orders' => 0, 'visitors' => 0, 'surveys' => 0];
        $visitorZones = [];

        foreach ($exhibitions as $exh) {
            $booths = $this->seedBooths($exh);
            $stats['booths'] += count($booths);
            $this->assignBooths($exh, $booths, $exhibitors);
            $stats['contracts'] += $this->seedContracts($exh, $booths, $exhibitors);
            $stats['orders'] += $this->seedOrders($exh, $booths, $exhibitors, $providers);
            $checked = $this->seedVisitors($exh);
            $stats['visitors'] += $checked;
            $stats['surveys'] += $this->seedSurveys($exh, $exhibitors);

            // 预热 Redis 展位状态缓存
            $this->cache->invalidateBoothStatuses($exh->getId());
            foreach ($booths as $b) {
                $this->cache->setBoothStatus($exh->getId(), $b->getId(), $b->getStatus());
            }
            for ($i = 1; $i <= 6; ++$i) {
                $this->cache->set('visitor:zone:'.$exh->getId(), (string) $i, (string) mt_rand(80, 520));
            }
        }

        $io->success('演示数据已生成');
        $io->table(['指标', '数量'], [
            ['展会', count($exhibitions)],
            ['参展商', 22],
            ['展位', $stats['booths']],
            ['合同', $stats['contracts']],
            ['服务工单', $stats['orders']],
            ['观众(已入场)', $stats['visitors']],
            ['满意度问卷', $stats['surveys']],
            ['Redis', $this->cache->isAvailable() ? '已连接' : '内存降级'],
        ]);

        return Command::SUCCESS;
    }

    private function truncate(SymfonyStyle $io): void
    {
        $tables = ['contract_log', 'contract', 'service_order', 'satisfaction_survey', 'visitor', 'booth', 'service_provider', 'exhibitor', 'exhibition'];
        $conn = $this->em->getConnection();
        $conn->executeStatement('PRAGMA foreign_keys = OFF');
        foreach ($tables as $t) {
            $conn->executeStatement('DELETE FROM '.$t);
            try {
                $conn->executeStatement("DELETE FROM sqlite_sequence WHERE name = '$t'");
            } catch (\Throwable) {
            }
        }
        $conn->executeStatement('PRAGMA foreign_keys = ON');
        $this->em->clear();
    }

    /** @return Exhibition[] */
    private function seedExhibitions(): array
    {
        $now = new \DateTime();
        $autoStart = (clone $now)->modify('-2 days');
        $homeStart = (clone $now)->modify('-1 days');

        $e1 = (new Exhibition())
            ->setName('2025华东国际汽车工业展览会')
            ->setType('汽车展')
            ->setHall('A馆 · 主展厅')
            ->setStatus(Exhibition::STATUS_ONGOING)
            ->setStartDate($autoStart)
            ->setEndDate((clone $autoStart)->modify('+5 days'));

        $e2 = (new Exhibition())
            ->setName('2025环球家居生活博览会')
            ->setType('家装展')
            ->setHall('B馆 · 综合展厅')
            ->setStatus(Exhibition::STATUS_RECRUITING)
            ->setStartDate((clone $homeStart)->modify('+7 days'))
            ->setEndDate((clone $homeStart)->modify('+10 days'));

        $this->em->persist($e1);
        $this->em->persist($e2);
        $this->em->flush();

        return [$e1, $e2];
    }

    /** @return Exhibitor[] */
    private function seedExhibitors(): array
    {
        $data = [
            ['上海智行新能源汽车', '汽车', '王志远', '13901234567', 280000],
            ['东风宏图汽车集团', '汽车', '李建华', '13801112233', 350000],
            ['蔚来驱动科技', '汽车', '张敏', '13704445566', 420000],
            ['博世汽车零部件', '汽车零部件', '陈伟', '13955667788', 300000],
            ['大陆汽车电子', '汽车零部件', '刘洋', '13677889900', 260000],
            ['德尔福动力系统', '汽车零部件', '赵磊', '13599887766', 240000],
            ['科大智能车联网', '汽车电子', '孙强', '13411223344', 180000],
            ['华为车载智能终端', '汽车电子', '周婷', '13322334455', 320000],
            ['宜家家居(中国)', '家居家具', '吴峰', '13933445566', 360000],
            ['全友家私集团', '家居家具', '郑丽', '13844556677', 220000],
            ['红星美凯龙', '家居家具', '冯刚', '13755667788', 410000],
            ['圣象地板', '建材厨卫', '蒋涛', '13666778899', 200000],
            ['东鹏瓷砖', '建材厨卫', '韩雪', '13577889900', 230000],
            ['九牧卫浴', '建材厨卫', '杨帆', '13488990011', 190000],
            ['海尔全屋智能家居', '智能家居', '朱琳', '13399001122', 380000],
            ['小米智能家居', '智能家居', '秦昊', '13900112233', 300000],
            ['欧普照明', '智能家居', '许雯', '13800224455', 170000],
            ['老板电器', '建材厨卫', '邓超', '13700335566', 210000],
            ['慕思寝具', '家居家具', '罗静', '13600447788', 195000],
            ['方太厨电', '建材厨卫', '宋杰', '13500559900', 225000],
            ['米家智能安防', '智能家居', '曹颖', '13400661122', 165000],
            ['立邦涂料', '建材厨卫', '彭勇', '13300772233', 155000],
        ];

        $list = [];
        foreach ($data as $i => [$name, $ind, $contact, $phone, $budget]) {
            $ex = (new Exhibitor())->setName($name)->setIndustry($ind)->setContact($contact)->setPhone($phone)->setBudget((string) $budget);
            $this->em->persist($ex);
            $list[$ind][] = $ex;
        }
        $this->em->flush();

        return $list;
    }

    /** @return ServiceProvider[] */
    private function seedProviders(): array
    {
        $map = [];
        $catalog = [
            ['华展电力服务', '电箱'],
            ['申城能源配套', '水电气'],
            ['联通会展网络', '网络'],
            ['中远吊装工程', '吊装'],
            ['洁邦会展保洁', '保洁'],
            ['沪上会展餐饮', '餐饮'],
            ['安盾安保服务', '安保'],
        ];
        foreach ($catalog as [$name, $cat]) {
            $p = (new ServiceProvider())->setName($name)->setCategory($cat);
            $this->em->persist($p);
            $map[$cat] = $p;
        }
        $this->em->flush();

        return $map;
    }

    /** @return Booth[] */
    private function seedBooths(Exhibition $exh): array
    {
        $cols = 10;
        $rows = 6;
        $w = 90;
        $h = 90;
        $gap = 8;
        $offset = 30;
        $prefix = 'A' === substr($exh->getHall(), 0, 1) ? 'A' : 'B';
        $unit = '汽车展' === $exh->getType() ? 1800 : 1500;

        $zoneInd = match ($exh->getType()) {
            '汽车展' => ['整车', '汽车零部件', '汽车电子'],
            '家装展' => ['家居家具', '建材厨卫', '智能家居'],
            default => ['综合', '综合', '综合'],
        };

        $booths = [];
        $seq = 1;
        for ($r = 0; $r < $rows; ++$r) {
            for ($c = 0; $c < $cols; ++$c) {
                $zone = (int) floor($r / 2);
                $isSpace = (0 === $c % 5);
                $area = $isSpace ? mt_rand(18, 36) : mt_rand(9, 12);
                $price = $area * $unit;
                $b = (new Booth())
                    ->setExhibition($exh)
                    ->setCode($prefix.sprintf('%02d', $seq))
                    ->setType($isSpace ? Booth::TYPE_SPACE : Booth::TYPE_STANDARD)
                    ->setArea((string) $area)
                    ->setOrientation(['东', '南', '西', '北'][mt_rand(0, 3)])
                    ->setPrice((string) $price)
                    ->setStatus(Booth::STATUS_AVAILABLE)
                    ->setIndustry($zoneInd[$zone])
                    ->setX($offset + $c * ($w + $gap))
                    ->setY($offset + $r * ($h + $gap))
                    ->setW($w)
                    ->setH($h);
                $this->em->persist($b);
                $booths[] = $b;
                ++$seq;
            }
        }
        $this->em->flush();

        return $booths;
    }

    /** @param Booth[] $booths */
    private function assignBooths(Exhibition $exh, array $booths, array $exhibitorsByIndustry): void
    {
        // 按行业聚集：把部分可预订展位分配给同行业参展商
        foreach ($booths as $b) {
            $roll = mt_rand(1, 100);
            if ($roll <= 55) {
                continue; // 保持可预订
            }
            $ind = $b->getIndustry();
            $pool = $exhibitorsByIndustry[$ind] ?? [];
            if (empty($pool)) {
                continue;
            }
            $ex = $pool[array_rand($pool)];
            $b->setExhibitor($ex);
            if ($roll <= 75) {
                $b->setStatus(Booth::STATUS_RESERVED);
            } elseif ($roll <= 90) {
                $b->setStatus(Booth::STATUS_CONTRACTED);
            } else {
                $b->setStatus(Booth::STATUS_PAID);
            }
        }
        $this->em->flush();
    }

    /** @param Booth[] $booths */
    private function seedContracts(Exhibition $exh, array $booths, array $exhibitorsByIndustry): int
    {
        $seq = 0;
        $count = 0;
        foreach ($booths as $b) {
            if (in_array($b->getStatus(), [Booth::STATUS_CONTRACTED, Booth::STATUS_PAID], true) && $b->getExhibitor()) {
                $isPaid = Booth::STATUS_PAID === $b->getStatus();
                $contract = (new Contract())
                    ->setCode('CT-'.$exh->getId().'-'.sprintf('%03d', ++$seq))
                    ->setExhibition($exh)
                    ->setExhibitor($b->getExhibitor())
                    ->setBooth($b)
                    ->setAmount($b->getPrice())
                    ->setStatus($isPaid ? Contract::STATUS_PAID : Contract::STATUS_SIGNED);
                $this->em->persist($contract);
                $this->addLog($contract, '销售经理', ContractLog::ACTION_SUBMIT, '提交展位租赁合同');
                $this->addLog($contract, '销售经理', ContractLog::ACTION_APPROVE, '销售经理初审通过');
                $this->addLog($contract, '财务', ContractLog::ACTION_APPROVE, '财务核价无误');
                $this->addLog($contract, '总经理', ContractLog::ACTION_APPROVE, '总经理审批通过');
                $this->addLog($contract, $b->getExhibitor()->getContact(), ContractLog::ACTION_SIGN, '参展商完成电子签章');
                if ($isPaid) {
                    $this->addLog($contract, '财务', ContractLog::ACTION_PAY, '收到全额款项，开具发票');
                }
                ++$count;
            }
        }
        $this->em->flush();

        return $count;
    }

    private function addLog(Contract $c, string $approver, string $action, string $comment): void
    {
        $log = (new ContractLog())
            ->setContract($c)
            ->setAction($action)
            ->setApprover($approver)
            ->setComment($comment)
            ->setStep($action);
        $c->addLog($log);
        $this->em->persist($log);
    }

    /** @param Booth[] $booths */
    private function seedOrders(Exhibition $exh, array $booths, array $exhibitorsByIndustry, array $providers): int
    {
        $taken = array_filter($booths, fn ($b) => null !== $b->getExhibitor());
        if (empty($taken)) {
            return 0;
        }
        $taken = array_values($taken);
        $count = 0;
        $cats = ServiceProvider::getCategories();
        for ($i = 0; $i < 26; ++$i) {
            $b = $taken[array_rand($taken)];
            $cat = $cats[array_rand($cats)];
            $fee = match ($cat) {
                '电箱' => mt_rand(800, 2600),
                '吊装' => mt_rand(1500, 6000),
                '保洁' => mt_rand(400, 1200),
                '餐饮' => mt_rand(600, 3000),
                '网络' => mt_rand(500, 2000),
                '水电气' => mt_rand(700, 2200),
                '安保' => mt_rand(900, 2800),
                default => 1000,
            };
            $roll = mt_rand(1, 100);
            $status = $roll <= 45 ? ServiceOrder::STATUS_DONE : ($roll <= 75 ? ServiceOrder::STATUS_ACCEPTED : ServiceOrder::STATUS_PENDING);
            $order = (new ServiceOrder())
                ->setExhibition($exh)
                ->setExhibitor($b->getExhibitor())
                ->setProvider($providers[$cat] ?? null)
                ->setCategory($cat)
                ->setFee((string) $fee)
                ->setStatus($status)
                ->setNote('展位 '.$b->getCode().' 订购 '.$cat.' 服务');
            $this->em->persist($order);
            ++$count;
        }
        $this->em->flush();

        return $count;
    }

    private function seedVisitors(Exhibition $exh): int
    {
        $total = 120;
        $checked = 0;
        $names = ['李', '王', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴'];
        $given = ['伟', '芳', '娜', '敏', '静', '强', '磊', '军', '洋', '勇'];
        $companyPrefix = ['上海', '北京', '广州', '深圳', '杭州', '苏州', '南京', '成都'];
        $companySuffix = ['科技有限公司', '贸易有限公司', '实业集团', '信息咨询', '制造有限公司', '网络科技'];
        $now = new \DateTimeImmutable();
        for ($i = 0; $i < $total; ++$i) {
            $name = $names[array_rand($names)].$given[array_rand($given)];
            $phone = '1'.mt_rand(30, 99).mt_rand(10000000, 99999999);
            $isPro = mt_rand(1, 100) <= 35;
            $checkedIn = mt_rand(1, 100) <= 42;
            $code = strtoupper(substr($exh->getName(), 2, 1)).'-'.date('ymd').'-'.mt_rand(1000, 9999).'-'.$i;
            $v = (new Visitor())
                ->setExhibition($exh)
                ->setName($name)
                ->setPhone($phone)
                ->setType($isPro ? Visitor::TYPE_PROFESSIONAL : Visitor::TYPE_PUBLIC)
                ->setTicketCode($code)
                ->setCheckedIn($checkedIn)
                ->setCheckinAt($checkedIn ? $now->modify('-'.mt_rand(0, 240).' minutes') : null);

            // 约 70% 观众提供画像信息
            if (mt_rand(1, 100) <= 70) {
                $v->setAgeGroup(Visitor::AGE_GROUPS[array_rand(Visitor::AGE_GROUPS)]);
                $genderRoll = mt_rand(1, 100);
                if ($genderRoll <= 55) { $v->setGender('male'); }
                elseif ($genderRoll <= 95) { $v->setGender('female'); }
                else { $v->setGender('other'); }
                $v->setRegion(Visitor::REGIONS[array_rand(Visitor::REGIONS)]);
            }
            // 专业观众和部分普通观众提供职业画像
            if ($isPro || mt_rand(1, 100) <= 40) {
                $v->setCompany($companyPrefix[array_rand($companyPrefix)].$companySuffix[array_rand($companySuffix)]);
                $v->setPosition(Visitor::POSITIONS[array_rand(Visitor::POSITIONS)]);
                $v->setIndustry(Visitor::VISITOR_INDUSTRIES[array_rand(Visitor::VISITOR_INDUSTRIES)]);
            }

            $this->em->persist($v);
            if ($checkedIn) {
                ++$checked;
            }
        }
        $this->em->flush();
        $this->cache->set('visitor:flow:'.$exh->getId(), (string) $checked);

        return $checked;
    }

    /**
     * @param array<string, Exhibitor[]> $exhibitorsByIndustry
     */
    private function seedSurveys(Exhibition $exh, array $exhibitorsByIndustry): int
    {
        $all = [];
        foreach ($exhibitorsByIndustry as $list) {
            foreach ($list as $e) { $all[] = $e; }
        }
        if (empty($all)) { return 0; }
        $count = 0;
        $feedbacks = [
            '场馆设施完善，指引清晰，下次还会参加。',
            '现场服务响应迅速，主办方组织能力很强。',
            '客流高峰期略显拥挤，建议增加通道。',
            '整体体验不错，同行观众质量较高。',
            '配套服务齐全，餐饮和休息区都很到位。',
            '希望能增加更多商务对接活动。',
        ];
        // 让约 60% 的参展商参与评价
        foreach ($all as $ex) {
            if (mt_rand(1, 100) > 60) { continue; }
            $base = mt_rand(3, 5);
            $venue = max(1, min(5, $base + mt_rand(-1, 1)));
            $service = max(1, min(5, $base + mt_rand(-1, 1)));
            $organization = max(1, min(5, $base + mt_rand(-1, 1)));
            $traffic = max(1, min(5, $base + mt_rand(-2, 0)));
            $overall = max(1, min(5, (int) round(($venue + $service + $organization + $traffic) / 4 + mt_rand(-1, 1) / 2)));
            $survey = (new SatisfactionSurvey())
                ->setExhibition($exh)
                ->setExhibitor($ex)
                ->setVenue($venue)
                ->setService($service)
                ->setOrganization($organization)
                ->setTraffic($traffic)
                ->setOverall($overall);
            if (mt_rand(1, 100) <= 55) {
                $survey->setFeedback($feedbacks[array_rand($feedbacks)]);
            }
            $this->em->persist($survey);
            ++$count;
        }
        $this->em->flush();

        return $count;
    }
}
