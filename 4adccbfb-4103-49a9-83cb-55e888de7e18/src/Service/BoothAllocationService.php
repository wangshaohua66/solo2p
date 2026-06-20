<?php

namespace App\Service;

use App\Entity\Booth;
use App\Entity\Exhibition;
use App\Entity\Exhibitor;
use Doctrine\ORM\EntityManagerInterface;

/**
 * 展位智能分配算法：根据参展商行业属性、面积需求、预算范围推荐最优展位组合。
 * 规则：1) 同行业区域聚集优先；2) 相邻展位优先锁定形成连片；3) 预算上限约束。
 */
class BoothAllocationService
{
    /** 展位分区行业 → 参展商顶级行业映射 */
    private const ZONE_TO_TOP = [
        '整车' => '汽车', '汽车零部件' => '汽车', '汽车电子' => '汽车',
        '家居家具' => '家居家装', '建材厨卫' => '家居家装', '智能家居' => '家居家装',
        '女装' => '服装纺织', '男装' => '服装纺织', '面辅料' => '服装纺织',
        '休闲食品' => '食品饮料', '酒水饮料' => '食品饮料', '生鲜粮油' => '食品饮料',
        '工程机械' => '机械装备', '数控机床' => '机械装备', '智能装备' => '机械装备',
    ];

    public function __construct(private readonly EntityManagerInterface $em, private readonly CacheService $cache)
    {
    }

    /**
     * 推荐展位组合。
     *
     * @return array{booths:Booth[],totalArea:float,totalPrice:float,reason:string}
     */
    public function recommend(Exhibition $ex, Exhibitor $exhibitor, float $areaNeed, float $budget, int $count): array
    {
        $available = $this->availableBooths($ex);
        if (!$available || $count < 1) {
            return ['booths' => [], 'totalArea' => 0, 'totalPrice' => 0, 'reason' => '当前展会无可预订展位'];
        }

        $count = min($count, count($available));
        $targetPer = $count > 0 ? $areaNeed / $count : 0;

        // 1) 行业聚集：优先同行业展位
        $same = array_values(array_filter($available, fn (Booth $b) => $this->industryMatch($b, $exhibitor)));
        $pool = count($same) >= $count ? $same : $available;

        // 2) 选择种子展位（面积最贴近单展位目标，性价比高）
        usort($pool, fn (Booth $a, Booth $b) => $this->seedScore($a, $targetPer) <=> $this->seedScore($b, $targetPer));
        $seed = $pool[0];
        $selected = [$seed];
        $selectedIds = [$seed->getId() => true];
        $remaining = array_values(array_filter($pool, fn (Booth $b) => !isset($selectedIds[$b->getId()])));

        // 3) 贪心扩展：每次选择距已选集合最近的展位，形成连片
        while (count($selected) < $count && $remaining) {
            $bestIdx = 0;
            $bestKey = PHP_FLOAT_MAX;
            foreach ($remaining as $i => $b) {
                $key = $this->nearestDistance($b, $selected) * 1000 + $this->seedScore($b, $targetPer);
                if ($key < $bestKey) {
                    $bestKey = $key;
                    $bestIdx = $i;
                }
            }
            $picked = $remaining[$bestIdx];
            $selected[] = $picked;
            $selectedIds[$picked->getId()] = true;
            array_splice($remaining, $bestIdx, 1);
        }

        // 4) 预算约束：超预算则移除最贵且与主簇最远的展位
        [$selected, $removedByBudget] = $this->fitBudget($selected, $budget);

        $totalArea = array_sum(array_map(fn (Booth $b) => (float) $b->getArea(), $selected));
        $totalPrice = array_sum(array_map(fn (Booth $b) => (float) $b->getPrice(), $selected));
        $clustered = count($same) >= $count && count($selected) === $count;

        $reason = sprintf(
            '已按「行业聚集 + 相邻连片 + 预算约束」推荐 %d 个展位，合计 %.0f ㎡，总价 ¥%s。',
            count($selected),
            $totalArea,
            number_format($totalPrice, 0, '.', ',')
        );
        if ($clustered) {
            $reason .= ' 所选展位均位于「'.$exhibitor->getIndustry().'」聚集区。';
        }
        if ($removedByBudget > 0) {
            $reason .= ' 因预算上限已剔除 '.$removedByBudget.' 个高价展位。';
        }

        return ['booths' => $selected, 'totalArea' => $totalArea, 'totalPrice' => $totalPrice, 'reason' => $reason];
    }

    /** 将推荐展位锁定给参展商（状态置为已预订），并刷新 Redis 缓存。 */
    public function allocate(array $booths, Exhibitor $exhibitor): int
    {
        $n = 0;
        foreach ($booths as $b) {
            if (Booth::STATUS_AVAILABLE === $b->getStatus()) {
                $b->setExhibitor($exhibitor)->setStatus(Booth::STATUS_RESERVED);
                ++$n;
            }
        }
        $this->em->flush();
        if ($booths) {
            $exId = $booths[0]->getExhibition()->getId();
            $this->cache->invalidateBoothStatuses($exId);
            foreach ($booths as $b) {
                $this->cache->setBoothStatus($exId, $b->getId(), $b->getStatus());
            }
        }

        return $n;
    }

    /** @return Booth[] */
    private function availableBooths(Exhibition $ex): array
    {
        return $this->em->getRepository(Booth::class)->findBy(['exhibition' => $ex, 'status' => Booth::STATUS_AVAILABLE]);
    }

    private function industryMatch(Booth $b, Exhibitor $e): bool
    {
        $top = self::ZONE_TO_TOP[$b->getIndustry() ?? ''] ?? $b->getIndustry();
        if ('综合' === $e->getIndustry()) {
            return true;
        }

        return $top === $e->getIndustry() || $b->getIndustry() === $e->getIndustry();
    }

    private function seedScore(Booth $b, float $targetPer): float
    {
        $area = (float) $b->getArea();
        $price = (float) $b->getPrice();

        return abs($area - $targetPer) + $price / 8000;
    }

    private function nearestDistance(Booth $b, array $set): float
    {
        $bx = $b->getX() + $b->getW() / 2;
        $by = $b->getY() + $b->getH() / 2;
        $min = PHP_FLOAT_MAX;
        foreach ($set as $s) {
            $sx = $s->getX() + $s->getW() / 2;
            $sy = $s->getY() + $s->getH() / 2;
            $d = hypot($bx - $sx, $by - $sy);
            if ($d < $min) {
                $min = $d;
            }
        }

        return $min;
    }

    /** @param Booth[] $selected */
    private function fitBudget(array $selected, float $budget): array
    {
        $removed = 0;
        while (count($selected) > 1) {
            $total = array_sum(array_map(fn (Booth $b) => (float) $b->getPrice(), $selected));
            if ($total <= $budget || $budget <= 0) {
                break;
            }
            // 移除最贵的展位
            $maxIdx = 0;
            $max = -1;
            foreach ($selected as $i => $b) {
                if ((float) $b->getPrice() > $max) {
                    $max = (float) $b->getPrice();
                    $maxIdx = $i;
                }
            }
            array_splice($selected, $maxIdx, 1);
            ++$removed;
        }

        return [$selected, $removed];
    }
}
