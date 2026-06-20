<?php

namespace App\Controller;

use App\Entity\Booth;
use App\Entity\Contract;
use App\Entity\Exhibition;
use App\Entity\ServiceOrder;
use App\Entity\Visitor;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class HomeController extends AbstractAppController
{
    #[Route('/', name: 'app_home')]
    public function index(): Response
    {
        $ex = $this->currentExhibition();
        $stats = $this->computeStats($ex);

        $recentContracts = $recentOrders = $pendingApprovals = [];
        if ($ex) {
            $recentContracts = $this->em->getRepository(Contract::class)
                ->findBy(['exhibition' => $ex], ['id' => 'DESC'], 6);
            $recentOrders = $this->em->getRepository(ServiceOrder::class)
                ->findBy(['exhibition' => $ex], ['id' => 'DESC'], 6);
            $pendingApprovals = $this->em->getRepository(Contract::class)
                ->findBy(['exhibition' => $ex, 'status' => [Contract::STATUS_PENDING_SM, Contract::STATUS_PENDING_FINANCE, Contract::STATUS_PENDING_GM]], ['id' => 'DESC'], 8);
        }

        return $this->render('home/index.html.twig', $this->viewVars([
            'ex' => $ex,
            'stats' => $stats,
            'recentContracts' => $recentContracts,
            'recentOrders' => $recentOrders,
            'pendingApprovals' => $pendingApprovals,
            'role' => $this->context->getRole(),
        ]));
    }

    #[Route('/role/switch', name: 'app_role_switch', methods: ['GET'])]
    public function switchRole(Request $request): Response
    {
        $this->context->setRole($request->query->getAlpha('role'));
        $referer = $request->headers->get('referer');

        return $this->redirect($referer ?: $this->generateUrl('app_home'));
    }

    #[Route('/exhibition/{id}/select', name: 'app_exhibition_select', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function selectExhibition(int $id, Request $request): Response
    {
        $this->context->setCurrentExhibitionId($id);
        $referer = $request->headers->get('referer');

        return $this->redirect($referer ?: $this->generateUrl('app_home'));
    }

    private function computeStats(?Exhibition $ex): array
    {
        if (!$ex) {
            return ['occupancy' => 0, 'revenue' => 0, 'visitors' => 0, 'orderRate' => 0, 'boothTotal' => 0, 'booked' => 0];
        }
        $boothRepo = $this->em->getRepository(Booth::class);
        $booths = $boothRepo->findBy(['exhibition' => $ex]);
        $total = count($booths);
        $booked = 0;
        $revenue = 0;
        foreach ($booths as $b) {
            if (Booth::STATUS_AVAILABLE !== $b->getStatus()) {
                ++$booked;
                if (in_array($b->getStatus(), [Booth::STATUS_CONTRACTED, Booth::STATUS_PAID], true)) {
                    $revenue += (float) $b->getPrice();
                }
            }
        }

        $orderTotal = $this->em->getRepository(ServiceOrder::class)->count(['exhibition' => $ex]);
        $orderDone = $this->em->getRepository(ServiceOrder::class)->count(['exhibition' => $ex, 'status' => ServiceOrder::STATUS_DONE]);
        $visitorIn = (int) $this->cache->getVisitorFlow($ex->getId());
        if (!$visitorIn) {
            $visitorIn = $this->em->getRepository(Visitor::class)->count(['exhibition' => $ex, 'checkedIn' => true]);
        }

        return [
            'occupancy' => $total ? round($booked / $total * 100, 1) : 0,
            'revenue' => $revenue,
            'visitors' => $visitorIn,
            'orderRate' => $orderTotal ? round($orderDone / $orderTotal * 100, 1) : 0,
            'boothTotal' => $total,
            'booked' => $booked,
            'orderTotal' => $orderTotal,
            'orderDone' => $orderDone,
        ];
    }
}
