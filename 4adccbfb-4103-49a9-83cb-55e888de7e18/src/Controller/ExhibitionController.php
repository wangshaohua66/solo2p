<?php

namespace App\Controller;

use App\Entity\Booth;
use App\Entity\Contract;
use App\Entity\Exhibition;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class ExhibitionController extends AbstractAppController
{
    private const TRANSITIONS = [
        Exhibition::STATUS_PREPARING => [Exhibition::STATUS_RECRUITING],
        Exhibition::STATUS_RECRUITING => [Exhibition::STATUS_ONGOING, Exhibition::STATUS_PREPARING],
        Exhibition::STATUS_ONGOING => [Exhibition::STATUS_ENDED],
        Exhibition::STATUS_ENDED => [],
    ];

    #[Route('/exhibition', name: 'app_exhibition_index', methods: ['GET'])]
    public function index(): Response
    {
        $exhibitions = $this->em->getRepository(Exhibition::class)->findBy([], ['id' => 'DESC']);
        $rows = [];
        foreach ($exhibitions as $e) {
            $booths = $this->em->getRepository(Booth::class)->count(['exhibition' => $e]);
            $booked = $this->em->getRepository(Booth::class)
                ->createQueryBuilder('b')
                ->select('COUNT(b.id)')
                ->where('b.exhibition = :e')->andWhere('b.status != :s')
                ->setParameter('e', $e)->setParameter('s', Booth::STATUS_AVAILABLE)
                ->getQuery()->getSingleScalarResult();
            $contracts = $this->em->getRepository(Contract::class)->count(['exhibition' => $e]);
            $rows[] = ['exhibition' => $e, 'booths' => $booths, 'booked' => (int) $booked, 'contracts' => $contracts];
        }

        return $this->render('exhibition/index.html.twig', $this->viewVars(['rows' => $rows]));
    }

    #[Route('/exhibition/new', name: 'app_exhibition_new', methods: ['GET'])]
    public function new(): Response
    {
        return $this->render('exhibition/new.html.twig', $this->viewVars([
            'types' => Exhibition::TYPES,
            'statuses' => Exhibition::STATUSES,
        ]));
    }

    #[Route('/exhibition', name: 'app_exhibition_create', methods: ['POST'])]
    public function store(Request $request): JsonResponse
    {
        $name = trim((string) $request->request->get('name'));
        if ('' === $name) {
            return $this->jsonError('展会名称不能为空');
        }
        try {
            $start = new \DateTime((string) $request->request->get('startDate'));
            $end = new \DateTime((string) $request->request->get('endDate'));
        } catch (\Throwable) {
            return $this->jsonError('展期日期格式不正确');
        }
        if ($end < $start) {
            return $this->jsonError('结束日期不能早于开始日期');
        }

        $ex = (new Exhibition())
            ->setName($name)
            ->setType((string) $request->request->get('type'))
            ->setHall((string) $request->request->get('hall'))
            ->setStatus((string) $request->request->get('status', Exhibition::STATUS_PREPARING))
            ->setStartDate($start)
            ->setEndDate($end);
        $this->em->persist($ex);
        $this->em->flush();

        $rows = (int) $request->request->get('gridRows');
        $cols = (int) $request->request->get('gridCols');
        if ($rows > 0 && $cols > 0) {
            $this->generateBoothGrid($ex, $rows, $cols, (float) $request->request->get('unitPrice', 1500));
        }
        $this->context->setCurrentExhibitionId($ex->getId());

        return $this->jsonOk(['redirect' => $this->generateUrl('app_exhibition_show', ['id' => $ex->getId()])], '展会创建成功');
    }

    #[Route('/exhibition/{id}', name: 'app_exhibition_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function show(int $id): Response
    {
        $ex = $this->em->find(Exhibition::class, $id);
        if (!$ex) {
            throw $this->createNotFoundException('展会不存在');
        }
        $boothRepo = $this->em->getRepository(Booth::class);
        $booths = $boothRepo->findBy(['exhibition' => $ex]);
        $statusCount = ['available' => 0, 'reserved' => 0, 'contracted' => 0, 'paid' => 0];
        foreach ($booths as $b) {
            ++$statusCount[$b->getStatus()];
        }
        $contracts = $this->em->getRepository(Contract::class)->findBy(['exhibition' => $ex], ['id' => 'DESC'], 8);
        $nextStatuses = self::TRANSITIONS[$ex->getStatus()] ?? [];

        return $this->render('exhibition/show.html.twig', $this->viewVars([
            'ex' => $ex,
            'booths' => $booths,
            'statusCount' => $statusCount,
            'contracts' => $contracts,
            'nextStatuses' => $nextStatuses,
            'transitions' => self::TRANSITIONS,
        ]));
    }

    #[Route('/exhibition/{id}/status', name: 'app_exhibition_status', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function changeStatus(Exhibition $ex, Request $request): JsonResponse
    {
        $target = (string) $request->request->get('status');
        $allowed = self::TRANSITIONS[$ex->getStatus()] ?? [];
        if (!in_array($target, $allowed, true)) {
            return $this->jsonError(sprintf('当前状态「%s」不允许变更为「%s」', $ex->getStatusLabel(), Exhibition::STATUSES[$target] ?? $target));
        }
        $ex->setStatus($target);
        $this->em->flush();

        return $this->jsonOk(['status' => $target, 'label' => $ex->getStatusLabel()], '展会状态已更新为：'.$ex->getStatusLabel());
    }

    /** 生成标准展位网格 */
    private function generateBoothGrid(Exhibition $ex, int $rows, int $cols, float $unitPrice): void
    {
        $w = 90;
        $h = 90;
        $gap = 8;
        $offset = 30;
        $zoneInd = match ($ex->getType()) {
            '汽车展' => ['整车', '汽车零部件', '汽车电子'],
            '家装展' => ['家居家具', '建材厨卫', '智能家居'],
            '服装展' => ['女装', '男装', '面辅料'],
            '食品展' => ['休闲食品', '酒水饮料', '生鲜粮油'],
            '机械展' => ['工程机械', '数控机床', '智能装备'],
            default => ['综合 A', '综合 B', '综合 C'],
        };
        $prefix = 'A' === substr($ex->getHall(), 0, 1) ? 'A' : 'B';
        $seq = 1;
        for ($r = 0; $r < $rows; ++$r) {
            for ($c = 0; $c < $cols; ++$c) {
                $zone = min((int) floor($r / max(1, ceil($rows / 3))), count($zoneInd) - 1);
                $isSpace = (0 === $c % 5);
                $area = $isSpace ? 24 : 9;
                $b = (new Booth())
                    ->setExhibition($ex)
                    ->setCode($prefix.sprintf('%02d', $seq))
                    ->setType($isSpace ? Booth::TYPE_SPACE : Booth::TYPE_STANDARD)
                    ->setArea((string) $area)
                    ->setOrientation(['东', '南', '西', '北'][($r + $c) % 4])
                    ->setPrice((string) ($area * $unitPrice))
                    ->setIndustry($zoneInd[$zone])
                    ->setX($offset + $c * ($w + $gap))
                    ->setY($offset + $r * ($h + $gap))
                    ->setW($w)->setH($h);
                $this->em->persist($b);
                ++$seq;
            }
        }
        $this->em->flush();
        foreach ($ex->getBooths() as $b) {
            $this->cache->setBoothStatus($ex->getId(), $b->getId(), $b->getStatus());
        }
    }
}
