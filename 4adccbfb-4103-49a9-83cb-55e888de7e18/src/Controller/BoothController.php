<?php

namespace App\Controller;

use App\Entity\Booth;
use App\Entity\Exhibitor;
use App\Service\BoothAllocationService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class BoothController extends AbstractAppController
{
    public function __construct(
        \App\Service\ContextService $context,
        \App\Service\CacheService $cache,
        \Doctrine\ORM\EntityManagerInterface $em,
        private readonly BoothAllocationService $allocator
    ) {
        parent::__construct($context, $cache, $em);
    }

    #[Route('/booth', name: 'app_booth_index', methods: ['GET'])]
    public function index(): Response
    {
        $ex = $this->currentExhibition();
        $exhibitors = $ex ? $this->em->getRepository(Exhibitor::class)->findBy([], ['name' => 'ASC']) : [];
        $exhibitorsData = array_map(fn (Exhibitor $e) => ['id' => $e->getId(), 'name' => $e->getName(), 'industry' => $e->getIndustry(), 'budget' => (float) $e->getBudget()], $exhibitors);

        return $this->render('booth/index.html.twig', $this->viewVars([
            'ex' => $ex,
            'exhibitors' => $exhibitors,
            'exhibitorsData' => $exhibitorsData,
        ]));
    }

    /** 展位实时数据接口（状态来自 Redis 缓存，满足 200ms 响应约束） */
    #[Route('/booth/api', name: 'app_booth_api', methods: ['GET'])]
    public function api(Request $request): JsonResponse
    {
        $ex = $this->currentExhibition();
        if (!$ex) {
            return $this->json(['booths' => [], 'legend' => Booth::STATUSES]);
        }
        $booths = $this->em->getRepository(Booth::class)->findBy(['exhibition' => $ex]);
        $cached = $this->cache->getBoothStatuses($ex->getId());

        $maxX = $maxY = 0;
        $list = [];
        foreach ($booths as $b) {
            $status = $cached[(string) $b->getId()] ?? $b->getStatus();
            $list[] = [
                'id' => $b->getId(),
                'code' => $b->getCode(),
                'type' => $b->getType(),
                'typeLabel' => $b->getTypeLabel(),
                'area' => (float) $b->getArea(),
                'orientation' => $b->getOrientation(),
                'price' => (float) $b->getPrice(),
                'industry' => $b->getIndustry(),
                'status' => $status,
                'statusLabel' => Booth::STATUSES[$status] ?? $status,
                'x' => $b->getX(),
                'y' => $b->getY(),
                'w' => $b->getW(),
                'h' => $b->getH(),
                'exhibitor' => $b->getExhibitor()?->getName(),
                'exhibitorId' => $b->getExhibitor()?->getId(),
            ];
            $maxX = max($maxX, $b->getX() + $b->getW());
            $maxY = max($maxY, $b->getY() + $b->getH());
        }
        $exhibitors = array_map(fn (Exhibitor $e) => ['id' => $e->getId(), 'name' => $e->getName(), 'industry' => $e->getIndustry(), 'budget' => (float) $e->getBudget()], $this->em->getRepository(Exhibitor::class)->findBy([], ['name' => 'ASC']));

        return $this->json([
            'booths' => $list,
            'exhibitors' => $exhibitors,
            'legend' => Booth::STATUSES,
            'exhibition' => ['id' => $ex->getId(), 'name' => $ex->getName(), 'hall' => $ex->getHall()],
            'viewBox' => ['w' => $maxX + 30, 'h' => $maxY + 30],
            'redis' => $this->cache->isAvailable(),
        ]);
    }

    #[Route('/booth/{id}/reserve', name: 'app_booth_reserve', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function reserve(Booth $b, Request $request): JsonResponse
    {
        if (Booth::STATUS_AVAILABLE !== $b->getStatus()) {
            return $this->jsonError('该展位当前不可预订（状态：'.$b->getStatusLabel().'）');
        }
        $exhibitor = $this->em->find(Exhibitor::class, (int) $request->request->get('exhibitorId'));
        if (!$exhibitor) {
            return $this->jsonError('请选择参展商');
        }
        $b->setExhibitor($exhibitor)->setStatus(Booth::STATUS_RESERVED);
        $this->em->flush();
        $this->cache->setBoothStatus($b->getExhibition()->getId(), $b->getId(), $b->getStatus());

        return $this->jsonOk(['status' => $b->getStatus(), 'statusLabel' => $b->getStatusLabel(), 'exhibitor' => $exhibitor->getName()], '展位 '.$b->getCode().' 已预订');
    }

    #[Route('/booth/{id}/release', name: 'app_booth_release', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function release(Booth $b): JsonResponse
    {
        if (in_array($b->getStatus(), [Booth::STATUS_CONTRACTED, Booth::STATUS_PAID], true)) {
            return $this->jsonError('已签约/已付款的展位不可直接释放，请先处理关联合同');
        }
        $b->setExhibitor(null)->setStatus(Booth::STATUS_AVAILABLE);
        $this->em->flush();
        $this->cache->setBoothStatus($b->getExhibition()->getId(), $b->getId(), $b->getStatus());

        return $this->jsonOk(['status' => $b->getStatus(), 'statusLabel' => $b->getStatusLabel()], '展位 '.$b->getCode().' 已释放');
    }

    #[Route('/booth/batch', name: 'app_booth_batch', methods: ['POST'])]
    public function batch(Request $request): JsonResponse
    {
        $ids = array_filter(array_map('intval', (array) $request->request->all('ids')));
        $action = $request->request->get('action');
        if (!$ids) {
            return $this->jsonError('未选择任何展位');
        }
        $booths = $this->em->getRepository(Booth::class)->findBy(['id' => $ids]);
        $exhibitor = 'reserve' === $action ? $this->em->find(Exhibitor::class, (int) $request->request->get('exhibitorId')) : null;
        if ('reserve' === $action && !$exhibitor) {
            return $this->jsonError('批量预订请选择参展商');
        }
        $n = 0;
        foreach ($booths as $b) {
            if ('reserve' === $action && Booth::STATUS_AVAILABLE === $b->getStatus()) {
                $b->setExhibitor($exhibitor)->setStatus(Booth::STATUS_RESERVED);
                ++$n;
            } elseif ('release' === $action && Booth::STATUS_RESERVED === $b->getStatus()) {
                $b->setExhibitor(null)->setStatus(Booth::STATUS_AVAILABLE);
                ++$n;
            }
        }
        $this->em->flush();
        if ($booths) {
            $exId = $booths[0]->getExhibition()->getId();
            foreach ($booths as $b) {
                $this->cache->setBoothStatus($exId, $b->getId(), $b->getStatus());
            }
        }

        return $this->jsonOk(['count' => $n], sprintf('已批量%s %d 个展位', 'reserve' === $action ? '预订' : '释放', $n));
    }

    #[Route('/booth/allocate', name: 'app_booth_allocate', methods: ['GET'])]
    public function allocate(): Response
    {
        $ex = $this->currentExhibition();
        $exhibitors = $ex ? $this->em->getRepository(Exhibitor::class)->findBy([], ['name' => 'ASC']) : [];

        return $this->render('booth/allocate.html.twig', $this->viewVars(['ex' => $ex, 'exhibitors' => $exhibitors]));
    }

    #[Route('/booth/allocate/recommend', name: 'app_booth_recommend', methods: ['POST'])]
    public function recommend(Request $request): JsonResponse
    {
        $ex = $this->currentExhibition();
        if (!$ex) {
            return $this->jsonError('请先选择展会');
        }
        $exhibitor = $this->em->find(Exhibitor::class, (int) $request->request->get('exhibitorId'));
        if (!$exhibitor) {
            return $this->jsonError('请选择参展商');
        }
        $area = (float) $request->request->get('area', 30);
        $budget = (float) $request->request->get('budget', $exhibitor->getBudget() ?: 200000);
        $count = max(1, (int) $request->request->get('count', 2));

        $result = $this->allocator->recommend($ex, $exhibitor, $area, $budget, $count);
        $booths = array_map(fn (Booth $b) => [
            'id' => $b->getId(), 'code' => $b->getCode(), 'area' => (float) $b->getArea(),
            'price' => (float) $b->getPrice(), 'industry' => $b->getIndustry(), 'orientation' => $b->getOrientation(),
        ], $result['booths']);

        return $this->jsonOk([
            'booths' => $booths,
            'totalArea' => round($result['totalArea'], 1),
            'totalPrice' => $result['totalPrice'],
            'reason' => $result['reason'],
            'exhibitorId' => $exhibitor->getId(),
        ], '推荐生成完成');
    }

    #[Route('/booth/allocate/apply', name: 'app_booth_apply', methods: ['POST'])]
    public function applyAllocation(Request $request): JsonResponse
    {
        $ex = $this->currentExhibition();
        if (!$ex) {
            return $this->jsonError('请先选择展会');
        }
        $exhibitor = $this->em->find(Exhibitor::class, (int) $request->request->get('exhibitorId'));
        if (!$exhibitor) {
            return $this->jsonError('请选择参展商');
        }
        $ids = array_filter(array_map('intval', (array) $request->request->all('ids')));
        if (!$ids) {
            return $this->jsonError('未选择展位');
        }
        $booths = $this->em->getRepository(Booth::class)->findBy(['id' => $ids]);
        $n = $this->allocator->allocate($booths, $exhibitor);

        return $this->jsonOk(['count' => $n, 'redirect' => $this->generateUrl('app_booth_index')], sprintf('已锁定 %d 个展位给「%s」', $n, $exhibitor->getName()));
    }
}
