<?php

namespace App\Controller;

use App\Entity\Booth;
use App\Entity\Contract;
use App\Entity\ContractLog;
use App\Entity\Exhibitor;
use App\Service\ContractWorkflowService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class ContractController extends AbstractAppController
{
    public function __construct(
        \App\Service\ContextService $context,
        \App\Service\CacheService $cache,
        \Doctrine\ORM\EntityManagerInterface $em,
        private readonly ContractWorkflowService $workflow
    ) {
        parent::__construct($context, $cache, $em);
    }

    #[Route('/contract', name: 'app_contract_index', methods: ['GET'])]
    public function index(Request $request): Response
    {
        $ex = $this->currentExhibition();
        $status = $request->query->get('status');
        $qb = $this->em->getRepository(Contract::class)->createQueryBuilder('c')
            ->where('c.exhibition = :e')->setParameter('e', $ex)->orderBy('c.id', 'DESC');
        if ($status && isset(Contract::STATUSES[$status])) {
            $qb->andWhere('c.status = :s')->setParameter('s', $status);
        }
        $contracts = $qb->getQuery()->getResult();

        // 各状态计数
        $counts = [];
        foreach (Contract::STATUSES as $code => $label) {
            $counts[$code] = $this->em->getRepository(Contract::class)->count(['exhibition' => $ex, 'status' => $code]);
        }

        // 用于新建合同模态框
        $exhibitors = $ex ? $this->em->getRepository(Exhibitor::class)->findBy([], ['name' => 'ASC']) : [];
        $booths = $ex ? $this->em->getRepository(Booth::class)->findBy(['exhibition' => $ex]) : [];
        $boothsData = array_map(fn (Booth $b) => [
            'id' => $b->getId(), 'code' => $b->getCode(), 'price' => (float) $b->getPrice(),
            'status' => $b->getStatus(), 'exhibitorId' => $b->getExhibitor()?->getId(),
        ], $booths);

        return $this->render('contract/index.html.twig', $this->viewVars([
            'ex' => $ex, 'contracts' => $contracts, 'counts' => $counts, 'currentStatus' => $status,
            'flow' => Contract::STATUSES, 'exhibitors' => $exhibitors, 'boothsData' => $boothsData,
        ]));
    }

    #[Route('/contract/new', name: 'app_contract_new', methods: ['GET'])]
    public function new(): Response
    {
        $ex = $this->currentExhibition();
        $exhibitors = $ex ? $this->em->getRepository(Exhibitor::class)->findBy([], ['name' => 'ASC']) : [];
        $booths = $ex ? $this->em->getRepository(Booth::class)->findBy(['exhibition' => $ex]) : [];
        $boothsData = array_map(fn (Booth $b) => [
            'id' => $b->getId(), 'code' => $b->getCode(), 'price' => (float) $b->getPrice(),
            'status' => $b->getStatus(), 'exhibitorId' => $b->getExhibitor()?->getId(),
        ], $booths);

        return $this->render('contract/new.html.twig', $this->viewVars([
            'ex' => $ex, 'exhibitors' => $exhibitors, 'boothsData' => $boothsData,
        ]));
    }

    #[Route('/contract', name: 'app_contract_create', methods: ['POST'])]
    public function store(Request $request): JsonResponse
    {
        $ex = $this->currentExhibition();
        if (!$ex) {
            return $this->jsonError('请先选择展会');
        }
        $exhibitor = $this->em->find(Exhibitor::class, (int) $request->request->get('exhibitorId'));
        $booth = $this->em->find(Booth::class, (int) $request->request->get('boothId'));
        if (!$exhibitor || !$booth) {
            return $this->jsonError('参展商或展位不存在');
        }
        if (in_array($booth->getStatus(), [Booth::STATUS_CONTRACTED, Booth::STATUS_PAID], true)) {
            return $this->jsonError('该展位已存在生效合同');
        }
        $amount = (float) $request->request->get('amount', $booth->getPrice());
        if ($amount <= 0) {
            return $this->jsonError('合同金额必须大于 0');
        }
        $code = 'CT-'.$ex->getId().'-'.sprintf('%03d', time() % 1000).mt_rand(10, 99);

        $contract = (new Contract())
            ->setCode($code)
            ->setExhibition($ex)
            ->setExhibitor($exhibitor)
            ->setBooth($booth)
            ->setAmount((string) $amount)
            ->setStatus(Contract::STATUS_DRAFT);
        // 展位锁定给参展商
        $booth->setExhibitor($exhibitor)->setStatus(Booth::STATUS_RESERVED);
        $this->em->persist($contract);
        $this->em->flush();
        // 初始提交日志
        $log = (new ContractLog())->setContract($contract)->setAction(ContractLog::ACTION_SUBMIT)
            ->setApprover($exhibitor->getContact() ?? '销售经理')->setStep(ContractLog::ACTION_SUBMIT)
            ->setComment('创建合同草稿');
        $contract->addLog($log);
        $this->em->persist($log);
        $this->em->flush();
        $this->cache->setBoothStatus($ex->getId(), $booth->getId(), $booth->getStatus());

        return $this->jsonOk(['redirect' => $this->generateUrl('app_contract_show', ['id' => $contract->getId()])], '合同已创建');
    }

    #[Route('/contract/{id}', name: 'app_contract_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function show(Contract $contract): Response
    {
        $role = $this->context->getRole();
        $actions = $this->workflow->availableActions($contract, $role);
        $stageRole = $role;

        return $this->render('contract/show.html.twig', $this->viewVars([
            'c' => $contract, 'actions' => $actions, 'role' => $role,
            'flow' => Contract::STATUSES,
        ]));
    }

    #[Route('/contract/{id}/action', name: 'app_contract_action', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function action(Contract $contract, Request $request): JsonResponse
    {
        $role = $this->context->getRole();
        $action = (string) $request->request->get('action');
        $comment = (string) $request->request->get('comment');
        $signature = (string) $request->request->get('signature');

        $available = array_map(fn (array $a) => $a['action'], $this->workflow->availableActions($contract, $role));
        if (!in_array($action, $available, true)) {
            return $this->jsonError('当前角色无权执行该操作');
        }
        try {
            $this->workflow->transition($contract, $action, $this->context->getRoleLabel(), $comment, $signature ?: null);
        } catch (\Throwable $e) {
            return $this->jsonError($e->getMessage());
        }
        $this->em->flush();
        if ($contract->getBooth()) {
            $this->cache->setBoothStatus($contract->getExhibition()->getId(), $contract->getBooth()->getId(), $contract->getBooth()->getStatus());
        }

        return $this->jsonOk(['status' => $contract->getStatus(), 'statusLabel' => $contract->getStatusLabel()], '合同状态已更新为：'.$contract->getStatusLabel());
    }
}
