<?php

namespace App\Controller;

use App\Entity\Booth;
use App\Entity\Contract;
use App\Entity\Exhibitor;
use App\Entity\ServiceOrder;
use App\Entity\Visitor;
use App\Service\SurveyService;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class DashboardController extends AbstractAppController
{
    public function __construct(
        \App\Service\ContextService $context,
        \App\Service\CacheService $cache,
        \Doctrine\ORM\EntityManagerInterface $em,
        private readonly SurveyService $survey
    ) {
        parent::__construct($context, $cache, $em);
    }

    #[Route('/dashboard', name: 'app_dashboard', methods: ['GET'])]
    public function index(): Response
    {
        $ex = $this->currentExhibition();
        $data = $this->buildData($ex);

        return $this->render('dashboard/index.html.twig', $this->viewVars([
            'ex' => $ex,
            'data' => $data,
        ]));
    }

    #[Route('/dashboard/satisfaction', name: 'app_dashboard_satisfaction', methods: ['GET'])]
    public function satisfaction(): Response
    {
        $ex = $this->currentExhibition();
        $report = $this->survey->getByExhibition($ex);

        return $this->render('dashboard/satisfaction.html.twig', $this->viewVars([
            'ex' => $ex, 'report' => $report, 'dimensions' => \App\Entity\SatisfactionSurvey::DIMENSIONS,
        ]));
    }

    private function buildData(?object $ex): array
    {
        $empty = [
            'booth' => ['total' => 0, 'available' => 0, 'reserved' => 0, 'contracted' => 0, 'paid' => 0, 'occupancy' => 0],
            'contract' => ['count' => 0, 'revenue' => 0, 'byStatus' => [], 'signed' => 0, 'paid' => 0],
            'visitor' => ['total' => 0, 'checkedIn' => 0, 'pro' => 0, 'pub' => 0, 'zones' => []],
            'order' => ['total' => 0, 'pending' => 0, 'accepted' => 0, 'done' => 0, 'rate' => 0],
            'industry' => [],
            'satisfaction' => ['count' => 0, 'average' => 0],
        ];
        if (!$ex) {
            return $empty;
        }

        $booths = $this->em->getRepository(Booth::class)->findBy(['exhibition' => $ex]);
        $bc = ['available' => 0, 'reserved' => 0, 'contracted' => 0, 'paid' => 0];
        foreach ($booths as $b) { ++$bc[$b->getStatus()]; }
        $booked = $bc['reserved'] + $bc['contracted'] + $bc['paid'];

        $contracts = $this->em->getRepository(Contract::class)->findBy(['exhibition' => $ex]);
        $byStatus = [];
        $revenue = 0;
        foreach ($contracts as $c) {
            $byStatus[$c->getStatus()] = ($byStatus[$c->getStatus()] ?? 0) + 1;
            if (in_array($c->getStatus(), [Contract::STATUS_SIGNED, Contract::STATUS_PAID], true)) {
                $revenue += (float) $c->getAmount();
            }
        }

        $vRepo = $this->em->getRepository(Visitor::class);
        $zones = $this->cache->getVisitorZones($ex->getId());
        if (empty($zones)) {
            for ($i = 1; $i <= 6; ++$i) { $zones[(string) $i] = 0; }
        }
        $checkedIn = (int) $this->cache->getVisitorFlow($ex->getId()) ?: $vRepo->count(['exhibition' => $ex, 'checkedIn' => true]);

        $orders = $this->em->getRepository(ServiceOrder::class)->findBy(['exhibition' => $ex]);
        $oc = ['pending' => 0, 'accepted' => 0, 'done' => 0];
        foreach ($orders as $o) { ++$oc[$o->getStatus()]; }

        $exhibitors = $this->em->getRepository(Exhibitor::class)->findAll();
        $ind = [];
        foreach ($exhibitors as $e) { $ind[$e->getIndustry()] = ($ind[$e->getIndustry()] ?? 0) + 1; }
        arsort($ind);

        return [
            'booth' => [
                'total' => count($booths), 'available' => $bc['available'], 'reserved' => $bc['reserved'],
                'contracted' => $bc['contracted'], 'paid' => $bc['paid'],
                'occupancy' => count($booths) ? round($booked / count($booths) * 100, 1) : 0,
            ],
            'contract' => [
                'count' => count($contracts), 'revenue' => $revenue, 'byStatus' => $byStatus,
                'signed' => $byStatus[Contract::STATUS_SIGNED] ?? 0, 'paid' => $byStatus[Contract::STATUS_PAID] ?? 0,
            ],
            'visitor' => [
                'total' => $vRepo->count(['exhibition' => $ex]),
                'checkedIn' => $checkedIn,
                'pro' => $vRepo->count(['exhibition' => $ex, 'type' => Visitor::TYPE_PROFESSIONAL]),
                'pub' => $vRepo->count(['exhibition' => $ex, 'type' => Visitor::TYPE_PUBLIC]),
                'zones' => $zones,
            ],
            'order' => [
                'total' => count($orders), 'pending' => $oc['pending'], 'accepted' => $oc['accepted'], 'done' => $oc['done'],
                'rate' => count($orders) ? round($oc['done'] / count($orders) * 100, 1) : 0,
            ],
            'industry' => $ind,
            'satisfaction' => ['count' => $this->survey->getByExhibition($ex)['count'], 'average' => $this->survey->getByExhibition($ex)['average']],
        ];
    }
}
