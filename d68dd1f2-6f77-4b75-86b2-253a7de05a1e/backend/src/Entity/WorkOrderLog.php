<?php

namespace App\Entity;

use App\Repository\WorkOrderLogRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: WorkOrderLogRepository::class)]
#[ORM\HasLifecycleCallbacks]
class WorkOrderLog
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['workorder:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'logs', targetEntity: WorkOrder::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?WorkOrder $workOrder = null;

    #[ORM\Column(length: 200)]
    #[Groups(['workorder:read'])]
    private ?string $action = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $detail = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    private ?User $operator = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['workorder:read'])]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\Column(length: 50, nullable: true)]
    private ?string $ipAddress = null;

    #[ORM\PrePersist]
    public function setCreatedAtValue(): void
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

    public function setWorkOrder(?WorkOrder $workOrder): static
    {
        $this->workOrder = $workOrder;
        return $this;
    }

    public function getAction(): ?string
    {
        return $this->action;
    }

    public function setAction(string $action): static
    {
        $this->action = $action;
        return $this;
    }

    public function getDetail(): ?string
    {
        return $this->detail;
    }

    public function setDetail(?string $detail): static
    {
        $this->detail = $detail;
        return $this;
    }

    public function getOperator(): ?User
    {
        return $this->operator;
    }

    public function setOperator(?User $operator): static
    {
        $this->operator = $operator;
        return $this;
    }

    /**
     * @Groups({"workorder:read"})
     */
    public function getOperatorName(): ?string
    {
        return $this->operator?->getRealName();
    }

    /**
     * @Groups({"workorder:read"})
     */
    public function getOperatorId(): ?int
    {
        return $this->operator?->getId();
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getIpAddress(): ?string
    {
        return $this->ipAddress;
    }

    public function setIpAddress(?string $ipAddress): static
    {
        $this->ipAddress = $ipAddress;
        return $this;
    }
}
