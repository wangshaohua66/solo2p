<?php

namespace App\Service;

use App\Entity\Contract;
use App\Entity\ContractLog;
use Doctrine\ORM\EntityManagerInterface;

/**
 * 合同审批状态机：草稿 → 销售经理 → 财务 → 总经理 → 签章 → 付款。
 * 任意审批节点可驳回；状态变更写入审批轨迹。
 */
class ContractWorkflowService
{
    public const ACTIONS = [
        'submit' => ['from' => Contract::STATUS_DRAFT, 'to' => Contract::STATUS_PENDING_SM, 'role' => 'sales', 'label' => '提交销售经理审批'],
        'approve_sm' => ['from' => Contract::STATUS_PENDING_SM, 'to' => Contract::STATUS_PENDING_FINANCE, 'role' => 'sales', 'label' => '销售经理审批通过'],
        'approve_finance' => ['from' => Contract::STATUS_PENDING_FINANCE, 'to' => Contract::STATUS_PENDING_GM, 'role' => 'finance', 'label' => '财务审批通过'],
        'approve_gm' => ['from' => Contract::STATUS_PENDING_GM, 'to' => Contract::STATUS_SIGNED, 'role' => 'gm', 'label' => '总经理审批通过'],
        'pay' => ['from' => Contract::STATUS_SIGNED, 'to' => Contract::STATUS_PAID, 'role' => 'finance', 'label' => '确认到款'],
    ];

    private const STAGE_ROLE = [
        Contract::STATUS_PENDING_SM => 'sales',
        Contract::STATUS_PENDING_FINANCE => 'finance',
        Contract::STATUS_PENDING_GM => 'gm',
    ];

    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function transition(Contract $contract, string $action, string $approver, string $comment = '', ?string $signature = null): Contract
    {
        if ('reject' === $action) {
            if (!isset(self::STAGE_ROLE[$contract->getStatus()])) {
                throw new \LogicException('当前状态不支持驳回');
            }
            $contract->setStatus(Contract::STATUS_REJECTED);
            $this->addLog($contract, $approver, ContractLog::ACTION_REJECT, $comment ?: '审批驳回');

            return $contract;
        }

        if ('sign' === $action) {
            if (Contract::STATUS_SIGNED !== $contract->getStatus()) {
                throw new \LogicException('仅已签章状态的合同可执行电子签章');
            }
            if ($signature) {
                $contract->setSignature($signature);
            }
            $this->addLog($contract, $approver, ContractLog::ACTION_SIGN, $comment ?: '完成电子签章');

            return $contract;
        }

        $def = self::ACTIONS[$action] ?? null;
        if (!$def) {
            throw new \LogicException('未知的审批动作：'.$action);
        }
        if ($contract->getStatus() !== $def['from']) {
            throw new \LogicException(sprintf('合同当前状态为「%s」，无法执行「%s」', $contract->getStatusLabel(), $def['label']));
        }
        $contract->setStatus($def['to']);
        $this->addLog($contract, $approver, ContractLog::ACTION_APPROVE, $comment ?: $def['label']);

        // 状态联动：合同签章/付款后，关联展位状态同步推进
        if (Contract::STATUS_SIGNED === $def['to'] && $contract->getBooth()) {
            $contract->getBooth()->setStatus(\App\Entity\Booth::STATUS_CONTRACTED);
        }
        if (Contract::STATUS_PAID === $def['to'] && $contract->getBooth()) {
            $contract->getBooth()->setStatus(\App\Entity\Booth::STATUS_PAID);
        }

        return $contract;
    }

    /** 当前角色可执行的动作 */
    public function availableActions(Contract $contract, string $role): array
    {
        $actions = [];
        foreach (self::ACTIONS as $key => $def) {
            if ($def['from'] === $contract->getStatus() && ($role === $def['role'] || 'organizer' === $role)) {
                $actions[] = ['action' => $key, 'label' => $def['label']];
            }
        }
        // 驳回：仅当前审批节点的角色
        if (isset(self::STAGE_ROLE[$contract->getStatus()])) {
            $stageRole = self::STAGE_ROLE[$contract->getStatus()];
            if ($role === $stageRole || 'organizer' === $role) {
                $actions[] = ['action' => 'reject', 'label' => '驳回'];
            }
        }
        // 电子签章：已签章且未签名，参展商/主办方/销售可签
        if (Contract::STATUS_SIGNED === $contract->getStatus() && !$contract->getSignature()
            && in_array($role, ['exhibitor', 'organizer', 'sales'], true)) {
            $actions[] = ['action' => 'sign', 'label' => '电子签章'];
        }

        return $actions;
    }

    private function addLog(Contract $contract, string $approver, string $action, string $comment): void
    {
        $log = (new ContractLog())
            ->setContract($contract)
            ->setApprover($approver)
            ->setAction($action)
            ->setStep($action)
            ->setComment($comment);
        $contract->addLog($log);
        $this->em->persist($log);
    }
}
