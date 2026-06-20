<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Doctrine\ODM\MongoDB\Types\Type;
use DateTimeImmutable;

#[MongoDB\Document(collection: 'movies')]
class Movie
{
    #[MongoDB\Id(strategy: 'NONE', type: Type::STRING)]
    private ?string $id = null;

    #[MongoDB\Field(type: Type::STRING)]
    private string $name;

    #[MongoDB\Field(type: Type::STRING)]
    private string $poster = '';

    #[MongoDB\Field(type: Type::INT)]
    private int $duration;

    #[MongoDB\Field(type: Type::STRING)]
    private string $genre;

    #[MongoDB\Field(type: Type::DATE_IMMUTABLE)]
    private DateTimeImmutable $releaseDate;

    #[MongoDB\Field(type: Type::FLOAT)]
    private float $rating = 0.0;

    #[MongoDB\Field(type: Type::INT)]
    private int $boxOffice = 0;

    #[MongoDB\Field(type: Type::INT)]
    private int $dcpCount = 0;

    #[MongoDB\Field(type: Type::STRING)]
    private string $status = '热映';

    #[MongoDB\Field(type: Type::INT)]
    private int $wantSee = 0;

    #[MongoDB\Field(type: Type::STRING)]
    private string $description = '';

    #[MongoDB\Field(type: Type::COLLECTION)]
    private array $directors = [];

    #[MongoDB\Field(type: Type::COLLECTION)]
    private array $actors = [];

    #[MongoDB\Field(type: Type::FLOAT)]
    private float $schedulingWeight = 0.0;

    #[MongoDB\Field(type: Type::DATE_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new DateTimeImmutable();
    }

    public function computeSchedulingWeight(): self
    {
        $boScore = min(1, $this->boxOffice / 500000000);
        $ratingScore = $this->rating / 10;
        $durationScore = $this->duration < 100 ? 0.9 : ($this->duration > 150 ? 0.7 : 1.0);
        $this->schedulingWeight = round($boScore * 0.45 + $ratingScore * 0.3 + $durationScore * 0.25, 2);
        return $this;
    }

    public function getId(): ?string { return $this->id; }
    public function setId(string $id): self { $this->id = $id; return $this; }
    public function getName(): string { return $this->name; }
    public function setName(string $name): self { $this->name = $name; return $this; }
    public function getPoster(): string { return $this->poster; }
    public function setPoster(string $poster): self { $this->poster = $poster; return $this; }
    public function getDuration(): int { return $this->duration; }
    public function setDuration(int $duration): self { $this->duration = $duration; return $this; }
    public function getGenre(): string { return $this->genre; }
    public function setGenre(string $genre): self { $this->genre = $genre; return $this; }
    public function getReleaseDate(): DateTimeImmutable { return $this->releaseDate; }
    public function setReleaseDate(DateTimeImmutable $releaseDate): self { $this->releaseDate = $releaseDate; return $this; }
    public function getRating(): float { return $this->rating; }
    public function setRating(float $rating): self { $this->rating = $rating; return $this; }
    public function getBoxOffice(): int { return $this->boxOffice; }
    public function setBoxOffice(int $boxOffice): self { $this->boxOffice = $boxOffice; return $this; }
    public function getDcpCount(): int { return $this->dcpCount; }
    public function setDcpCount(int $dcpCount): self { $this->dcpCount = $dcpCount; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): self { $this->status = $status; return $this; }
    public function getSchedulingWeight(): float { return $this->schedulingWeight; }
    public function setSchedulingWeight(float $schedulingWeight): self { $this->schedulingWeight = $schedulingWeight; return $this; }
}
