<?php

namespace App\Service;

use App\Entity\Warranty;
use App\Repository\WarrantyRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\Address;
use Twig\Environment;

class WarrantyNotificationService
{
    private const WARN_DAYS = 60;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly WarrantyRepository $warrantyRepo,
        private readonly MailerInterface $mailer,
        private readonly LoggerInterface $logger,
        private readonly Environment $twig,
        private readonly string $studioName = '腕表维修服务中心',
        private readonly string $senderEmail = 'service@watchstudio.com',
        private readonly string $studioPhone = '400-800-1234',
    ) {}

    public function checkAndNotify(): array
    {
        $start = microtime(true);
        $stats = [
            'totalChecked' => 0,
            'expiringSoon' => 0,
            'expired' => 0,
            'notified' => 0,
            'failed' => 0,
            'expiringList' => [],
            'expiredList' => [],
        ];

        $now = new \DateTimeImmutable();

        $activeWarranties = $this->warrantyRepo->createQueryBuilder('w')
            ->join('w.workOrder', 'wo')
            ->join('w.customer', 'c')
            ->addSelect('wo')
            ->addSelect('c')
            ->where('w.status = :active')
            ->setParameter('active', Warranty::STATUS_ACTIVE)
            ->orderBy('w.endDate', 'ASC')
            ->getQuery()
            ->getResult();

        foreach ($activeWarranties as $warranty) {
            $stats['totalChecked']++;

            $daysLeft = $warranty->getDaysRemaining();
            $endDate = $warranty->getEndDate();

            if ($daysLeft <= 0) {
                $stats['expired']++;
                if ($warranty->getStatus() !== Warranty::STATUS_EXPIRED) {
                    $warranty->setStatus(Warranty::STATUS_EXPIRED);
                    $order = $warranty->getWorkOrder();
                    if ($order) {
                        $order->addLogEntry('质保到期', sprintf(
                            '质保已于 %s 到期，工单：%s',
                            $endDate?->format('Y-m-d'),
                            $order->getOrderNumber()
                        ));
                    }
                }
                $stats['expiredList'][] = $this->summarize($warranty);
                continue;
            }

            if ($daysLeft <= self::WARN_DAYS) {
                $stats['expiringSoon']++;
                $entry = $this->summarize($warranty);

                $needsNotify = false;
                $notifyType = null;

                if ($daysLeft <= 7 && $warranty->getSecondReminderSentAt() === null) {
                    $needsNotify = true;
                    $notifyType = 'second';
                } elseif ($daysLeft <= 30 && $warranty->getFirstReminderSentAt() === null) {
                    $needsNotify = true;
                    $notifyType = 'first';
                } elseif ($daysLeft <= self::WARN_DAYS && $warranty->getWarnNotifiedAt() === null) {
                    $needsNotify = true;
                    $notifyType = 'warm';
                }

                if ($needsNotify) {
                    try {
                        $this->sendNotification($warranty, $daysLeft, $notifyType);
                        $this->markNotified($warranty, $notifyType);
                        $order = $warranty->getWorkOrder();
                        if ($order) {
                            $order->addLogEntry('质保提醒', sprintf(
                                '%s通知已发送，剩余%d天，接收人：%s',
                                $this->notifyLabel($notifyType),
                                $daysLeft,
                                $warranty->getCustomer()?->getEmail() ?: $warranty->getCustomer()?->getPhone()
                            ));
                        }
                        $entry['notified'] = true;
                        $entry['notifyType'] = $notifyType;
                        $stats['notified']++;
                    } catch (\Throwable $e) {
                        $stats['failed']++;
                        $entry['error'] = $e->getMessage();
                        $this->logger->error('Warranty notification failed', [
                            'warranty' => $warranty->getId(),
                            'daysLeft' => $daysLeft,
                            'type' => $notifyType,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }

                $stats['expiringList'][] = $entry;
            }
        }

        $this->em->flush();

        $stats['durationMs'] = round((microtime(true) - $start) * 1000, 1);
        $this->logger->info('Warranty check completed', $stats);

        return $stats;
    }

    public function manualNotify(int $warrantyId, string $channel = 'email'): bool
    {
        $warranty = $this->warrantyRepo->find($warrantyId);
        if (!$warranty) {
            throw new \Symfony\Component\HttpKernel\Exception\NotFoundHttpException('质保记录不存在');
        }

        $daysLeft = $warranty->getDaysRemaining();

        try {
            $this->sendNotification($warranty, $daysLeft, 'manual', $channel);
            $this->markNotified($warranty, 'manual');

            $order = $warranty->getWorkOrder();
            if ($order) {
                $order->addLogEntry('质保提醒', sprintf(
                    '手动%s提醒已发送，剩余%d天',
                    $channel === 'email' ? '邮件' : '短信',
                    $daysLeft
                ));
            }
            $this->em->flush();
            return true;
        } catch (\Throwable $e) {
            $this->logger->error('Manual warranty notify failed', [
                'warranty' => $warrantyId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    public function listExpiring(int $withinDays = 60): array
    {
        $now = new \DateTimeImmutable();
        $limit = $now->modify(sprintf('+%d days', $withinDays));

        $qb = $this->warrantyRepo->createQueryBuilder('w')
            ->join('w.workOrder', 'wo')
            ->join('w.customer', 'c')
            ->addSelect('wo')
            ->addSelect('c')
            ->where('w.status = :active')
            ->andWhere('w.endDate <= :limit')
            ->andWhere('w.endDate >= :now')
            ->setParameter('active', Warranty::STATUS_ACTIVE)
            ->setParameter('limit', $limit)
            ->setParameter('now', $now)
            ->orderBy('w.endDate', 'ASC');

        $list = $qb->getQuery()->getResult();

        $grouped = [
            'critical' => [],
            'warning' => [],
            'attention' => [],
        ];

        foreach ($list as $w) {
            $days = $w->getDaysRemaining();
            $summary = $this->summarize($w);
            if ($days <= 7) {
                $grouped['critical'][] = $summary;
            } elseif ($days <= 30) {
                $grouped['warning'][] = $summary;
            } else {
                $grouped['attention'][] = $summary;
            }
        }

        return [
            'withinDays' => $withinDays,
            'total' => count($list),
            'breakdown' => [
                'critical' => count($grouped['critical']),
                'warning' => count($grouped['warning']),
                'attention' => count($grouped['attention']),
            ],
            'items' => $grouped,
        ];
    }

    private function sendNotification(Warranty $warranty, int $daysLeft, string $type, string $channel = 'email'): void
    {
        $customer = $warranty->getCustomer();
        $order = $warranty->getWorkOrder();
        if (!$customer) {
            throw new \RuntimeException('无客户信息');
        }

        $email = $customer->getEmail();
        $phone = $customer->getPhone();

        if ($channel === 'email' && $email) {
            $this->sendEmail($warranty, $customer, $order, $daysLeft, $type);
        }
        if ($phone) {
            $this->sendSmsStub($warranty, $customer, $order, $daysLeft, $type);
        }
    }

    private function sendEmail(Warranty $warranty, $customer, $order, int $daysLeft, string $type): void
    {
        $subjectMap = [
            'warm' => sprintf('【温馨提醒】%s的腕表质保即将到期', $customer->getName()),
            'first' => sprintf('【重要提醒】%s的腕表质保还剩%d天', $customer->getName(), $daysLeft),
            'second' => sprintf('【紧急提醒】%s的腕表质保仅剩%d天！', $customer->getName(), $daysLeft),
            'manual' => sprintf('【质保提醒】%s的腕表质保服务通知', $customer->getName()),
            'expired' => sprintf('【通知】%s的腕表质保已到期', $customer->getName()),
        ];

        $endDate = $warranty->getEndDate()?->format('Y年m月d日') ?? '';

        $email = (new Email())
            ->from(new Address($this->senderEmail, $this->studioName))
            ->to($customer->getEmail())
            ->subject($subjectMap[$type] ?? $subjectMap['warm'])
            ->html($this->twig->render('email/warranty_reminder.html.twig', [
                'customerName' => $customer->getName(),
                'daysLeft' => $daysLeft,
                'endDate' => $endDate,
                'orderNumber' => $order?->getOrderNumber() ?? '',
                'brand' => $order?->getBrand() ?? '',
                'model' => $order?->getModel() ?? '',
                'studioName' => $this->studioName,
                'studioPhone' => $this->studioPhone,
                'severity' => $type,
            ]));

        $this->mailer->send($email);
    }

    private function sendSmsStub(Warranty $warranty, $customer, $order, int $daysLeft, string $type): void
    {
        $msg = sprintf(
            '【%s】%s您好，您的%s %s（工单号%s）质保服务还有%d天到期（至%s），可联系%s延长保养。',
            $this->studioName,
            $customer->getName(),
            $order?->getBrand() ?? '',
            $order?->getModel() ?? '',
            $order?->getOrderNumber() ?? '',
            $daysLeft,
            $warranty->getEndDate()?->format('Y-m-d') ?? '',
            $this->studioPhone
        );

        $this->logger->info('SMS_SENT_STUB', [
            'phone' => $customer->getPhone(),
            'message' => $msg,
            'warrantyId' => $warranty->getId(),
            'type' => $type,
        ]);
    }

    private function markNotified(Warranty $warranty, string $type): void
    {
        $now = new \DateTimeImmutable();
        $warranty->setNotificationCount($warranty->getNotificationCount() + 1);

        switch ($type) {
            case 'warm':
                $warranty->setWarnNotifiedAt($now);
                break;
            case 'first':
                $warranty->setFirstReminderSentAt($now);
                break;
            case 'second':
                $warranty->setSecondReminderSentAt($now);
                break;
            case 'manual':
                break;
        }
    }

    private function summarize(Warranty $warranty): array
    {
        $customer = $warranty->getCustomer();
        $order = $warranty->getWorkOrder();
        return [
            'warrantyId' => $warranty->getId(),
            'orderId' => $order?->getId(),
            'orderNumber' => $order?->getOrderNumber() ?? '',
            'brand' => $order?->getBrand() ?? '',
            'model' => $order?->getModel() ?? '',
            'customerId' => $customer?->getId(),
            'customerName' => $customer?->getName() ?? '',
            'customerPhone' => $customer?->getPhone() ?? '',
            'customerEmail' => $customer?->getEmail() ?? '',
            'startDate' => $warranty->getStartDate()?->format('Y-m-d'),
            'endDate' => $warranty->getEndDate()?->format('Y-m-d'),
            'months' => $warranty->getMonths(),
            'status' => $warranty->getStatus(),
            'daysRemaining' => $warranty->getDaysRemaining(),
            'notificationCount' => $warranty->getNotificationCount(),
            'firstReminderAt' => $warranty->getFirstReminderSentAt()?->format('Y-m-d'),
            'secondReminderAt' => $warranty->getSecondReminderSentAt()?->format('Y-m-d'),
        ];
    }

    private function notifyLabel(string $type): string
    {
        return match ($type) {
            'warm' => '质保预警',
            'first' => '首次（30天）',
            'second' => '最终（7天）',
            'manual' => '手动',
            default => '',
        };
    }
}
