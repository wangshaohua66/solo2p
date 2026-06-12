<?php

namespace App\Entity;

use App\Repository\PartUsageRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: PartUsageRepository::class)]
#[ORM\HasLifecycleCallbacks]
class PartUsage
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['workorder:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'partUsages', targetEntity: WorkOrder::class)]
    #[ORM\JoinColumn(nullable: false)]
    private ?WorkOrder $workOrder = null;

    #[ORM\ManyToOne(targetEntity: Parts::class)]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['workorder:read'])]
    private ?Parts $part = null;

    #[ORM\Column(type: Types::INTEGER)]
    #[Groups(['workorder:read'])]
    private ?int $quantity = null;

    #[ORM\Column(type: Types::DECIMAL, precision: 10, scale: 2)]
    #[Groups(['workorder:read'])]
    private string $unitPrice = '0.00';

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $batchNumber = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['workorder:read'])]
    private ?\DateTimeImmutable $usedAt = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[Groups(['workorder:read'])]
    private ?User $technician = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $remark = null;

    #[ORM\PrePersist]
    public function setTimestamp(): void
    {
        $this->usedAt = new \DateTimeImmutable();
        if ($this->unitPrice === '0.00' && $this->part !== null) {
            $this->unitPrice = $this->part->getUnitPrice();
        }
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

    public function getPart(): ?Parts
    {
        return $this->part;
    }

    public function setPart(?Parts $part): static
    {
        $this->part = $part;
        return $this;
    }

    public function getQuantity(): ?int
    {
        return $this->quantity;
    }

    public function setQuantity(int $quantity): static
    {
        $this->quantity = $quantity;
        return $this;
    }

    public function getUnitPrice(): string
    {
        return $this->unitPrice;
    }

    public function setUnitPrice(string $unitPrice): static
    {
        $this->unitPrice = $unitPrice;
        return $this;
    }

    public function getBatchNumber(): ?string
    {
        return $this->batchNumber;
    }

    public function setBatchNumber(?string $batchNumber): static
    {
        $this->batchNumber = $batchNumber;
        return $this;
    }

    public function getUsedAt(): ?\DateTimeImmutable
    {
        return $this->usedAt;
    }

    public function getTechnician(): ?User
    {
        return $this->technician;
    }

    public function setTechnician(?User $technician): static
    {
        $this->technician = $technician;
        return $this;
    }

    public function getRemark(): ?string
    {
        return $this->remark;
    }

    public function setRemark(?string $remark): static
    {
        $this->remark = $remark;
        return $this;
    }

    public function getSubtotal(): float
    {
        return (float)$this->unitPrice * (int)$this->quantity;
    }

    /**
     * @Groups({"workorder:read"})
     */
    public function getTechnicianId(): ?int
    {
        return $this->technician?->getId();
    }
}
