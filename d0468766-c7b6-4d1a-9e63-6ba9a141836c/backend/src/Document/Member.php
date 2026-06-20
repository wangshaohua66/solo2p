<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Doctrine\ODM\MongoDB\Types\Type;
use DateTimeImmutable;

#[MongoDB\Document(collection: 'members')]
#[MongoDB\Index(keys: ['phone' => 'asc'], options: ['unique' => true])]
class Member
{
    public const LEVEL_BRONZE = 'bronze';
    public const LEVEL_SILVER = 'silver';
    public const LEVEL_GOLD = 'gold';
    public const LEVEL_PLATINUM = 'platinum';

    #[MongoDB\Id(strategy: 'NONE', type: Type::STRING)]
    private ?string $id = null;

    #[MongoDB\Field(type: Type::STRING)]
    private string $name;

    #[MongoDB\Field(type: Type::STRING)]
    private string $phone;

    #[MongoDB\Field(type: Type::STRING, nullable: true)]
    private ?string $email = null;

    #[MongoDB\Field(type: Type::STRING, nullable: true)]
    private ?string $birthday = null;

    #[MongoDB\Field(type: Type::STRING)]
    private string $level = self::LEVEL_BRONZE;

    #[MongoDB\Field(type: Type::INT)]
    private int $points = 0;

    #[MongoDB\Field(type: Type::INT)]
    private int $totalSpent = 0;

    #[MongoDB\Field(type: Type::INT)]
    private int $watchCount = 0;

    #[MongoDB\Field(type: Type::INT)]
    private int $couponCount = 0;

    #[MongoDB\Field(type: Type::STRING, nullable: true)]
    private ?string $cinemaId = null;

    #[MongoDB\Field(type: Type::STRING)]
    private string $status = 'active';

    #[MongoDB\Field(type: Type::COLLECTION)]
    private array $tags = [];

    #[MongoDB\Field(type: Type::COLLECTION)]
    private array $preferredGenres = [];

    #[MongoDB\Field(type: Type::DATE_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    #[MongoDB\Field(type: Type::DATE_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $lastVisitAt = null;

    public function __construct()
    {
        $this->createdAt = new DateTimeImmutable();
    }

    public function calculateLevel(): string
    {
        if ($this->totalSpent >= 5000) {
            return self::LEVEL_PLATINUM;
        }
        if ($this->totalSpent >= 2000) {
            return self::LEVEL_GOLD;
        }
        if ($this->totalSpent >= 500) {
            return self::LEVEL_SILVER;
        }
        return self::LEVEL_BRONZE;
    }

    public function getId(): ?string { return $this->id; }
    public function setId(string $id): self { $this->id = $id; return $this; }
    public function getName(): string { return $this->name; }
    public function setName(string $name): self { $this->name = $name; return $this; }
    public function getPhone(): string { return $this->phone; }
    public function setPhone(string $phone): self { $this->phone = $phone; return $this; }
    public function getEmail(): ?string { return $this->email; }
    public function setEmail(?string $email): self { $this->email = $email; return $this; }
    public function getLevel(): string { return $this->level; }
    public function setLevel(string $level): self { $this->level = $level; return $this; }
    public function getPoints(): int { return $this->points; }
    public function setPoints(int $points): self { $this->points = $points; return $this; }
    public function getTotalSpent(): int { return $this->totalSpent; }
    public function setTotalSpent(int $totalSpent): self { $this->totalSpent = $totalSpent; return $this; }
    public function getWatchCount(): int { return $this->watchCount; }
    public function setWatchCount(int $watchCount): self { $this->watchCount = $watchCount; return $this; }
    public function getCouponCount(): int { return $this->couponCount; }
    public function setCouponCount(int $couponCount): self { $this->couponCount = $couponCount; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): self { $this->status = $status; return $this; }
    public function getBirthday(): ?string { return $this->birthday; }
    public function setBirthday(?string $birthday): self { $this->birthday = $birthday; return $this; }
    public function getTags(): array { return $this->tags; }
    public function setTags(array $tags): self { $this->tags = $tags; return $this; }
    public function getPreferredGenres(): array { return $this->preferredGenres; }
    public function setPreferredGenres(array $preferredGenres): self { $this->preferredGenres = $preferredGenres; return $this; }
    public function getCinemaId(): ?string { return $this->cinemaId; }
    public function setCinemaId(?string $cinemaId): self { $this->cinemaId = $cinemaId; return $this; }
    public function getLastVisitAt(): ?DateTimeImmutable { return $this->lastVisitAt; }
    public function setLastVisitAt(?DateTimeImmutable $lastVisitAt): self { $this->lastVisitAt = $lastVisitAt; return $this; }
}
