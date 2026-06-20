<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Doctrine\ODM\MongoDB\Types\Type;
use DateTimeImmutable;

#[MongoDB\Document(collection: 'cinemas')]
class Cinema
{
    #[MongoDB\Id(strategy: 'NONE', type: Type::STRING)]
    private ?string $id = null;

    #[MongoDB\Field(type: Type::STRING)]
    private string $name;

    #[MongoDB\Field(type: Type::STRING)]
    private string $address;

    #[MongoDB\Field(type: Type::STRING)]
    private string $phone;

    #[MongoDB\Field(type: Type::STRING)]
    private string $businessHours;

    #[MongoDB\Field(type: Type::INT)]
    private int $halls;

    #[MongoDB\Field(type: Type::INT)]
    private int $screens;

    #[MongoDB\Field(type: Type::STRING)]
    private string $manager;

    #[MongoDB\Field(type: Type::STRING)]
    private string $status = 'open';

    #[MongoDB\Field(type: Type::INT)]
    private int $todayBoxOffice = 0;

    #[MongoDB\Field(type: Type::INT)]
    private int $todayAudience = 0;

    #[MongoDB\Field(type: Type::COLLECTION)]
    private array $tags = [];

    #[MongoDB\Field(type: Type::COLLECTION)]
    private array $images = [];

    #[MongoDB\Field(type: Type::FLOAT)]
    private float $rating = 5.0;

    #[MongoDB\Field(type: Type::DATE_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    #[MongoDB\Field(type: Type::DATE_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $updatedAt = null;

    public function __construct()
    {
        $this->createdAt = new DateTimeImmutable();
    }

    public function getId(): ?string { return $this->id; }
    public function setId(string $id): self { $this->id = $id; return $this; }
    public function getName(): string { return $this->name; }
    public function setName(string $name): self { $this->name = $name; return $this; }
    public function getAddress(): string { return $this->address; }
    public function setAddress(string $address): self { $this->address = $address; return $this; }
    public function getPhone(): string { return $this->phone; }
    public function setPhone(string $phone): self { $this->phone = $phone; return $this; }
    public function getBusinessHours(): string { return $this->businessHours; }
    public function setBusinessHours(string $businessHours): self { $this->businessHours = $businessHours; return $this; }
    public function getHalls(): int { return $this->halls; }
    public function setHalls(int $halls): self { $this->halls = $halls; return $this; }
    public function getScreens(): int { return $this->screens; }
    public function setScreens(int $screens): self { $this->screens = $screens; return $this; }
    public function getManager(): string { return $this->manager; }
    public function setManager(string $manager): self { $this->manager = $manager; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): self { $this->status = $status; return $this; }
    public function getTodayBoxOffice(): int { return $this->todayBoxOffice; }
    public function setTodayBoxOffice(int $todayBoxOffice): self { $this->todayBoxOffice = $todayBoxOffice; return $this; }
    public function getTodayAudience(): int { return $this->todayAudience; }
    public function setTodayAudience(int $todayAudience): self { $this->todayAudience = $todayAudience; return $this; }
    public function getTags(): array { return $this->tags; }
    public function setTags(array $tags): self { $this->tags = $tags; return $this; }
    public function getImages(): array { return $this->images; }
    public function setImages(array $images): self { $this->images = $images; return $this; }
    public function getRating(): float { return $this->rating; }
    public function setRating(float $rating): self { $this->rating = $rating; return $this; }
}
