<?php

namespace App\Entity;

use App\Repository\PartsRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: PartsRepository::class)]
#[ORM\HasLifecycleCallbacks]
#[ORM\Index(name: 'idx_sku', columns: ['sku'])]
#[ORM\Index(name: 'idx_barcode', columns: ['barcode'])]
#[ORM\Index(name: 'idx_stock', columns: ['stock'])]
#[ORM\Table(name: 'parts')]
class Parts
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['parts:read', 'parts:list', 'workorder:read', 'public:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 50, unique: true)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 50)]
    #[Groups(['parts:read', 'parts:list', 'workorder:read', 'public:read'])]
    private ?string $sku = null;

    #[ORM\Column(length: 200)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 200)]
    #[Groups(['parts:read', 'parts:list', 'workorder:read', 'public:read'])]
    private ?string $name = null;

    #[ORM\ManyToOne(targetEntity: PartCategory::class)]
    #[ORM\JoinColumn(nullable: true)]
    #[Groups(['parts:read', 'parts:list', 'public:read'])]
    private ?PartCategory $category = null;

    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['parts:read', 'parts:list', 'public:read'])]
    private ?string $brand = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['parts:read', 'parts:list'])]
    private ?string $movementCode = null;

    #[ORM\Column(type: Types::DECIMAL, precision: 10, scale: 2, options: ['default' => 0])]
    #[Assert\GreaterThanOrEqual(0)]
    #[Groups(['parts:read', 'parts:list', 'workorder:read', 'public:read'])]
    private string $unitPrice = '0.00';

    #[ORM\Column(type: Types::INTEGER, options: ['default' => 0])]
    #[Assert\GreaterThanOrEqual(0)]
    #[Groups(['parts:read', 'parts:list', 'public:read'])]
    private int $stock = 0;

    #[ORM\Column(type: Types::INTEGER, options: ['default' => 5])]
    #[Groups(['parts:read', 'parts:list'])]
    private int $reorderLevel = 5;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['parts:read', 'parts:list', 'public:read'])]
    private ?string $location = null;

    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['parts:read', 'parts:list', 'public:read'])]
    private ?string $barcode = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['parts:read'])]
    private ?string $description = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['parts:read'])]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private ?\DateTimeImmutable $updatedAt = null;

    /**
     * @var Collection<int, PartUsage>
     */
    #[ORM\OneToMany(mappedBy: 'part', targetEntity: PartUsage::class)]
    private Collection $partUsages;

    public function __construct()
    {
        $this->partUsages = new ArrayCollection();
    }

    #[ORM\PrePersist]
    public function setCreatedAtValue(): void
    {
        $now = new \DateTimeImmutable();
        $this->createdAt = $now;
        $this->updatedAt = $now;
    }

    #[ORM\PreUpdate]
    public function setUpdatedAtValue(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getSku(): ?string
    {
        return $this->sku;
    }

    public function setSku(string $sku): static
    {
        $this->sku = $sku;
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

    public function getCategory(): ?PartCategory
    {
        return $this->category;
    }

    public function setCategory(?PartCategory $category): static
    {
        $this->category = $category;
        return $this;
    }

    public function getBrand(): ?string
    {
        return $this->brand;
    }

    public function setBrand(?string $brand): static
    {
        $this->brand = $brand;
        return $this;
    }

    public function getMovementCode(): ?string
    {
        return $this->movementCode;
    }

    public function setMovementCode(?string $movementCode): static
    {
        $this->movementCode = $movementCode;
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

    public function getStock(): int
    {
        return $this->stock;
    }

    public function setStock(int $stock): static
    {
        $this->stock = $stock;
        return $this;
    }

    public function adjustStock(int $quantity): static
    {
        $this->stock += $quantity;
        return $this;
    }

    public function getReorderLevel(): int
    {
        return $this->reorderLevel;
    }

    public function setReorderLevel(int $reorderLevel): static
    {
        $this->reorderLevel = $reorderLevel;
        return $this;
    }

    public function isLowStock(): bool
    {
        return $this->stock <= $this->reorderLevel;
    }

    public function getLocation(): ?string
    {
        return $this->location;
    }

    public function setLocation(?string $location): static
    {
        $this->location = $location;
        return $this;
    }

    public function getBarcode(): ?string
    {
        return $this->barcode;
    }

    public function setBarcode(?string $barcode): static
    {
        $this->barcode = $barcode;
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

    public function getUpdatedAt(): ?\DateTimeImmutable
    {
        return $this->updatedAt;
    }

    /**
     * @return Collection<int, PartUsage>
     */
    public function getPartUsages(): Collection
    {
        return $this->partUsages;
    }
}
