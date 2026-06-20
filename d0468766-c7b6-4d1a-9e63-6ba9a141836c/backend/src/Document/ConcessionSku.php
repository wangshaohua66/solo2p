<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Doctrine\ODM\MongoDB\Types\Type;
use DateTimeImmutable;

#[MongoDB\Document(collection: 'concession_skus')]
class ConcessionSku
{
    public const STATUS_NORMAL = 'normal';
    public const STATUS_LOW_STOCK = 'low_stock';
    public const STATUS_OUT_OF_STOCK = 'out_of_stock';

    #[MongoDB\Id(strategy: 'NONE', type: Type::STRING)]
    private ?string $id = null;

    #[MongoDB\Field(type: Type::STRING)]
    private string $name;

    #[MongoDB\Field(type: Type::STRING, nullable: true)]
    private ?string $image = null;

    #[MongoDB\Field(type: Type::STRING)]
    private string $category;

    #[MongoDB\Field(type: Type::INT)]
    private int $price;

    #[MongoDB\Field(type: Type::INT)]
    private int $cost;

    #[MongoDB\Field(type: Type::INT)]
    private int $stock;

    #[MongoDB\Field(type: Type::INT)]
    private int $reorderLevel = 20;

    #[MongoDB\Field(type: Type::INT)]
    private int $reorderQuantity = 50;

    #[MongoDB\Field(type: Type::STRING, nullable: true)]
    private ?string $cinemaId = null;

    #[MongoDB\Field(type: Type::STRING)]
    private string $status = self::STATUS_NORMAL;

    #[MongoDB\Field(type: Type::BOOL)]
    private bool $active = true;

    #[MongoDB\Field(type: Type::INT)]
    private int $soldToday = 0;

    #[MongoDB\Field(type: Type::INT)]
    private int $soldWeek = 0;

    #[MongoDB\Field(type: Type::INT)]
    private int $soldMonth = 0;

    #[MongoDB\Field(type: Type::STRING)]
    private string $unit = '份';

    #[MongoDB\Field(type: Type::COLLECTION)]
    private array $tags = [];

    #[MongoDB\Field(type: Type::DATE_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    #[MongoDB\Field(type: Type::DATE_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $lastRestockedAt = null;

    public function __construct()
    {
        $this->createdAt = new DateTimeImmutable();
    }

    public function refreshStatus(): string
    {
        if ($this->stock <= 0) {
            $this->status = self::STATUS_OUT_OF_STOCK;
        } elseif ($this->stock <= $this->reorderLevel) {
            $this->status = self::STATUS_LOW_STOCK;
        } else {
            $this->status = self::STATUS_NORMAL;
        }
        return $this->status;
    }

    public function needsRestock(): bool
    {
        return in_array($this->refreshStatus(), [self::STATUS_LOW_STOCK, self::STATUS_OUT_OF_STOCK], true);
    }

    public function getId(): ?string { return $this->id; }
    public function setId(string $id): self { $this->id = $id; return $this; }
    public function getName(): string { return $this->name; }
    public function setName(string $name): self { $this->name = $name; return $this; }
    public function getImage(): ?string { return $this->image; }
    public function setImage(?string $image): self { $this->image = $image; return $this; }
    public function getCategory(): string { return $this->category; }
    public function setCategory(string $category): self { $this->category = $category; return $this; }
    public function getPrice(): int { return $this->price; }
    public function setPrice(int $price): self { $this->price = $price; return $this; }
    public function getCost(): int { return $this->cost; }
    public function setCost(int $cost): self { $this->cost = $cost; return $this; }
    public function getStock(): int { return $this->stock; }
    public function setStock(int $stock): self { $this->stock = $stock; $this->refreshStatus(); return $this; }
    public function getReorderLevel(): int { return $this->reorderLevel; }
    public function setReorderLevel(int $reorderLevel): self { $this->reorderLevel = $reorderLevel; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): self { $this->status = $status; return $this; }
    public function isActive(): bool { return $this->active; }
    public function setActive(bool $active): self { $this->active = $active; return $this; }
    public function getSoldToday(): int { return $this->soldToday; }
    public function setSoldToday(int $soldToday): self { $this->soldToday = $soldToday; return $this; }
    public function getSoldWeek(): int { return $this->soldWeek; }
    public function setSoldWeek(int $soldWeek): self { $this->soldWeek = $soldWeek; return $this; }
    public function getSoldMonth(): int { return $this->soldMonth; }
    public function setSoldMonth(int $soldMonth): self { $this->soldMonth = $soldMonth; return $this; }
    public function getUnit(): string { return $this->unit; }
    public function setUnit(string $unit): self { $this->unit = $unit; return $this; }
    public function getCinemaId(): ?string { return $this->cinemaId; }
    public function setCinemaId(?string $cinemaId): self { $this->cinemaId = $cinemaId; return $this; }
    public function getReorderQuantity(): int { return $this->reorderQuantity; }
    public function setReorderQuantity(int $reorderQuantity): self { $this->reorderQuantity = $reorderQuantity; return $this; }
    public function getTags(): array { return $this->tags; }
    public function setTags(array $tags): self { $this->tags = $tags; return $this; }
}
