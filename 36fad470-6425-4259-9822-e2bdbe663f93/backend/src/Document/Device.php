<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Symfony\Component\Serializer\Annotation\Groups;

#[MongoDB\Document(collection: 'devices')]
#[MongoDB\Index(keys: ['category' => 1, 'status' => 1])]
class Device
{
    public const CATEGORY_LIGHTING = 'lighting';
    public const CATEGORY_SOUND = 'sound';
    public const CATEGORY_STAGE = 'stage';

    public const STATUS_AVAILABLE = 'available';
    public const STATUS_IN_USE = 'in_use';
    public const STATUS_MAINTENANCE = 'maintenance';
    public const STATUS_DAMAGED = 'damaged';

    #[MongoDB\Id]
    #[Groups(['device:read', 'device:list'])]
    private ?string $id = null;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['device:read', 'device:list'])]
    private string $name;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['device:read', 'device:list'])]
    private string $category;

    #[MongoDB\Field(type: 'string', nullable: true)]
    #[Groups(['device:read'])]
    private ?string $specification = null;

    #[MongoDB\Field(type: 'int')]
    #[Groups(['device:read', 'device:list'])]
    private int $quantity;

    #[MongoDB\Field(type: 'int')]
    #[Groups(['device:read', 'device:list'])]
    private int $availableQuantity;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['device:read', 'device:list'])]
    private string $status = self::STATUS_AVAILABLE;

    #[MongoDB\EmbedMany(targetDocument: DeviceMaintenance::class)]
    #[Groups(['device:read'])]
    private Collection $maintenanceSchedule;

    #[MongoDB\Field(type: 'date')]
    #[Groups(['device:read'])]
    private \DateTimeInterface $createdAt;

    public function __construct()
    {
        $this->maintenanceSchedule = new ArrayCollection();
        $this->createdAt = new \DateTime();
    }

    public function getId(): ?string
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function getCategory(): string
    {
        return $this->category;
    }

    public function setCategory(string $category): self
    {
        $this->category = $category;
        return $this;
    }

    public function getSpecification(): ?string
    {
        return $this->specification;
    }

    public function setSpecification(?string $specification): self
    {
        $this->specification = $specification;
        return $this;
    }

    public function getQuantity(): int
    {
        return $this->quantity;
    }

    public function setQuantity(int $quantity): self
    {
        $this->quantity = $quantity;
        return $this;
    }

    public function getAvailableQuantity(): int
    {
        return $this->availableQuantity;
    }

    public function setAvailableQuantity(int $availableQuantity): self
    {
        $this->availableQuantity = $availableQuantity;
        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): self
    {
        $this->status = $status;
        return $this;
    }

    public function getMaintenanceSchedule(): Collection
    {
        return $this->maintenanceSchedule;
    }

    public function addMaintenanceSchedule(DeviceMaintenance $maintenance): self
    {
        if (!$this->maintenanceSchedule->contains($maintenance)) {
            $this->maintenanceSchedule->add($maintenance);
        }
        return $this;
    }

    public function removeMaintenanceSchedule(DeviceMaintenance $maintenance): self
    {
        $this->maintenanceSchedule->removeElement($maintenance);
        return $this;
    }

    public function getCreatedAt(): \DateTimeInterface
    {
        return $this->createdAt;
    }
}
