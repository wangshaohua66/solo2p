<?php

namespace App\Entity;

use App\Repository\ServiceItemRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: ServiceItemRepository::class)]
class ServiceItem
{
    public const TYPE_LABOR = 'labor';
    public const TYPE_PART = 'part';
    public const TYPE_OTHER = 'other';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['workorder:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'serviceItems', targetEntity: WorkOrder::class)]
    #[ORM\JoinColumn(nullable: false)]
    private ?WorkOrder $workOrder = null;

    #[ORM\Column(length: 32)]
    #[Groups(['workorder:read'])]
    private string $type = self::TYPE_LABOR;

    #[ORM\Column(length: 200)]
    #[Groups(['workorder:read'])]
    private ?string $name = null;

    #[ORM\Column(type: Types::INTEGER)]
    #[Groups(['workorder:read'])]
    private int $quantity = 1;

    #[ORM\Column(type: Types::DECIMAL, precision: 10, scale: 2)]
    #[Groups(['workorder:read'])]
    private string $unitPrice = '0.00';

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $description = null;

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

    public function setWorkOrder(?WorkOrder $workOrder): static
    {
        $this->workOrder = $workOrder;
        return $this;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): static
    {
        $this->type = $type;
        return $this;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;
        return $this;
    }

    public function getQuantity(): int
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

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): static
    {
        $this->description = $description;
        return $this;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getSubtotal(): float
    {
        return (float)$this->unitPrice * $this->quantity;
    }
}
