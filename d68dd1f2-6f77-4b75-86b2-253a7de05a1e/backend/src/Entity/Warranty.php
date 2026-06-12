<?php

namespace App\Entity;

use App\Repository\WarrantyRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: WarrantyRepository::class)]
#[ORM\Index(name: 'idx_end_date', columns: ['end_date'])]
#[ORM\Index(name: 'idx_status', columns: ['status'])]
class Warranty
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_CLAIMED = 'claimed';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['workorder:read', 'warranty:read'])]
    private ?int $id = null;

    #[ORM\OneToOne(inversedBy: 'warranty', targetEntity: WorkOrder::class)]
    #[ORM\JoinColumn(nullable: false, unique: true)]
    private ?WorkOrder $workOrder = null;

    #[ORM\ManyToOne(targetEntity: Customer::class)]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['warranty:read'])]
    private ?Customer $customer = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['workorder:read', 'warranty:read'])]
    private ?\DateTimeImmutable $startDate = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['workorder:read', 'warranty:read'])]
    private ?\DateTimeImmutable $endDate = null;

    #[ORM\Column(type: Types::INTEGER)]
    #[Groups(['workorder:read', 'warranty:read'])]
    private int $months = 12;

    #[ORM\Column(type: Types::TEXT)]
    #[Groups(['workorder:read'])]
    private string $terms = '本次维修服务提供官方质保，质保范围涵盖本次维修涉及的机芯零件与人工服务。非人为损坏（如进水、摔碰、自行开盖、非正常使用等）不在质保范围内。质保期内凭此保证卡可享免费返修。';

    #[ORM\Column(length: 32)]
    #[Groups(['workorder:read', 'warranty:read'])]
    private string $status = self::STATUS_ACTIVE;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $notifiedAt = null;

    #[ORM\Column(type: Types::INTEGER, options: ['default' => 0])]
    private int $notificationCount = 0;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $warnNotifiedAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $firstReminderSentAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $secondReminderSentAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\PrePersist]
    public function setTimestamp(): void
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getWorkOrder(): ?WorkOrder
    {
        return $this->workOrder;
    }

    public function setWorkOrder(WorkOrder $workOrder): static
    {
        $this->workOrder = $workOrder;
        return $this;
    }

    public function getCustomer(): ?Customer
    {
        return $this->customer;
    }

    public function setCustomer(Customer $customer): static
    {
        $this->customer = $customer;
        return $this;
    }

    public function getStartDate(): ?\DateTimeImmutable
    {
        return $this->startDate;
    }

    public function setStartDate(\DateTimeImmutable $startDate): static
    {
        $this->startDate = $startDate;
        return $this;
    }

    public function getEndDate(): ?\DateTimeImmutable
    {
        return $this->endDate;
    }

    public function setEndDate(\DateTimeImmutable $endDate): static
    {
        $this->endDate = $endDate;
        return $this;
    }

    public function getMonths(): int
    {
        return $this->months;
    }

    public function setMonths(int $months): static
    {
        $this->months = $months;
        return $this;
    }

    public function getTerms(): string
    {
        return $this->terms;
    }

    public function setTerms(string $terms): static
    {
        $this->terms = $terms;
        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): static
    {
        $this->status = $status;
        return $this;
    }

    public function getNotifiedAt(): ?\DateTimeImmutable
    {
        return $this->notifiedAt;
    }

    public function setNotifiedAt(?\DateTimeImmutable $notifiedAt): static
    {
        $this->notifiedAt = $notifiedAt;
        return $this;
    }

    public function getNotifyAttempts(): int
    {
        return $this->notificationCount;
    }

    public function incrementNotifyAttempts(): static
    {
        $this->notificationCount++;
        return $this;
    }

    public function getNotificationCount(): int
    {
        return $this->notificationCount;
    }

    public function setNotificationCount(int $notificationCount): static
    {
        $this->notificationCount = $notificationCount;
        return $this;
    }

    public function getWarnNotifiedAt(): ?\DateTimeImmutable
    {
        return $this->warnNotifiedAt;
    }

    public function setWarnNotifiedAt(\DateTimeImmutable $warnNotifiedAt): static
    {
        $this->warnNotifiedAt = $warnNotifiedAt;
        return $this;
    }

    public function getFirstReminderSentAt(): ?\DateTimeImmutable
    {
        return $this->firstReminderSentAt;
    }

    public function setFirstReminderSentAt(\DateTimeImmutable $firstReminderSentAt): static
    {
        $this->firstReminderSentAt = $firstReminderSentAt;
        return $this;
    }

    public function getSecondReminderSentAt(): ?\DateTimeImmutable
    {
        return $this->secondReminderSentAt;
    }

    public function setSecondReminderSentAt(\DateTimeImmutable $secondReminderSentAt): static
    {
        $this->secondReminderSentAt = $secondReminderSentAt;
        return $this;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE && $this->endDate >= new \DateTimeImmutable();
    }

    public function getDaysRemaining(): int
    {
        $now = new \DateTimeImmutable();
        return max(0, $this->endDate->diff($now)->days * ($this->endDate > $now ? 1 : -1));
    }

    public function getWorkOrderId(): int
    {
        return $this->workOrder->getId();
    }

    public function getCustomerId(): int
    {
        return $this->customer->getId();
    }
}
