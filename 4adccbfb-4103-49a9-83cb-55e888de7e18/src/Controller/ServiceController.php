<?php

namespace App\Controller;

use App\Entity\Exhibitor;
use App\Entity\ServiceOrder;
use App\Entity\ServiceProvider;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class ServiceController extends AbstractAppController
{
    #[Route('/service', name: 'app_service_index', methods: ['GET'])]
    public function index(Request $request): Response
    {
        $ex = $this->currentExhibition();
        $status = $request->query->get('status');
        $category = $request->query->get('category');

        $qb = $this->em->getRepository(ServiceOrder::class)->createQueryBuilder('o')
            ->where('o.exhibition = :e')->setParameter('e', $ex)->orderBy('o.id', 'DESC');
        if ($status) { $qb->andWhere('o.status = :s')->setParameter('s', $status); }
        if ($category) { $qb->andWhere('o.category = :c')->setParameter('c', $category); }
        $orders = $qb->getQuery()->getResult();

        $counts = ['pending' => 0, 'accepted' => 0, 'done' => 0];
        foreach ($this->em->getRepository(ServiceOrder::class)->findBy(['exhibition' => $ex]) as $o) {
            ++$counts[$o->getStatus()];
        }

        return $this->render('service/index.html.twig', $this->viewVars([
            'ex' => $ex, 'orders' => $orders, 'counts' => $counts, 'categories' => ServiceProvider::getCategories(),
            'currentStatus' => $status, 'currentCategory' => $category,
        ]));
    }

    #[Route('/service/new', name: 'app_service_new', methods: ['GET'])]
    public function new(): Response
    {
        $ex = $this->currentExhibition();
        $exhibitors = $ex ? $this->em->getRepository(Exhibitor::class)->findBy([], ['name' => 'ASC']) : [];

        return $this->render('service/new.html.twig', $this->viewVars([
            'ex' => $ex, 'exhibitors' => $exhibitors, 'categories' => ServiceProvider::getCategories(),
            'categoryFees' => ['电箱' => 1500, '水电气' => 1200, '网络' => 1000, '吊装' => 3000, '保洁' => 800, '餐饮' => 1500, '安保' => 1800],
        ]));
    }

    #[Route('/service', name: 'app_service_create', methods: ['POST'])]
    public function store(Request $request): JsonResponse
    {
        $ex = $this->currentExhibition();
        if (!$ex) { return $this->jsonError('请先选择展会'); }
        $exhibitor = $this->em->find(Exhibitor::class, (int) $request->request->get('exhibitorId'));
        if (!$exhibitor) { return $this->jsonError('请选择参展商'); }
        $category = (string) $request->request->get('category');
        if (!in_array($category, ServiceProvider::getCategories(), true)) { return $this->jsonError('服务类别无效'); }
        $fee = (float) $request->request->get('fee', 0);
        if ($fee <= 0) { return $this->jsonError('费用必须大于 0'); }
        $provider = $this->em->getRepository(ServiceProvider::class)->findOneBy(['category' => $category]);
        $order = (new ServiceOrder())
            ->setExhibition($ex)->setExhibitor($exhibitor)->setProvider($provider)
            ->setCategory($category)->setFee((string) $fee)->setStatus(ServiceOrder::STATUS_PENDING)
            ->setNote((string) $request->request->get('note'));
        $this->em->persist($order);
        $this->em->flush();

        return $this->jsonOk(['redirect' => $this->generateUrl('app_service_show', ['id' => $order->getId()])], '服务工单已创建');
    }

    #[Route('/service/{id}', name: 'app_service_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function show(ServiceOrder $order): Response
    {
        return $this->render('service/show.html.twig', $this->viewVars(['o' => $order, 'role' => $this->context->getRole()]));
    }

    #[Route('/service/{id}/accept', name: 'app_service_accept', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function accept(ServiceOrder $order): JsonResponse
    {
        if (ServiceOrder::STATUS_PENDING !== $order->getStatus()) {
            return $this->jsonError('仅待接单工单可接单');
        }
        $order->setStatus(ServiceOrder::STATUS_ACCEPTED);
        $this->em->flush();

        return $this->jsonOk(['status' => $order->getStatus(), 'statusLabel' => $order->getStatusLabel()], '服务商已接单，开始执行');
    }

    #[Route('/service/{id}/progress', name: 'app_service_progress', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function progress(ServiceOrder $order, Request $request): JsonResponse
    {
        $done = 'done' === $request->request->get('to');
        if (ServiceOrder::STATUS_ACCEPTED !== $order->getStatus()) {
            return $this->jsonError('仅进行中工单可更新进度');
        }
        if ($done) {
            $order->setStatus(ServiceOrder::STATUS_DONE);
        }
        $this->em->flush();

        return $this->jsonOk(['status' => $order->getStatus(), 'statusLabel' => $order->getStatusLabel()], $done ? '工单已完成' : '进度已记录');
    }

    #[Route('/service/dispatch', name: 'app_service_dispatch', methods: ['GET'])]
    public function dispatch(): Response
    {
        $ex = $this->currentExhibition();
        $orders = $ex ? $this->em->getRepository(ServiceOrder::class)->findBy(['exhibition' => $ex], ['status' => 'ASC', 'id' => 'DESC']) : [];
        $grouped = [];
        foreach ($orders as $o) {
            $grouped[$o->getCategory()][] = $o;
        }

        return $this->render('service/dispatch.html.twig', $this->viewVars([
            'ex' => $ex, 'grouped' => $grouped, 'categories' => ServiceProvider::getCategories(),
        ]));
    }
}
