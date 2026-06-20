<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Doctrine\ODM\MongoDB\Types\Type;
use DateTimeImmutable;

#[MongoDB\Document(collection: 'schedules')]
#[MongoDB\Index(keys: ['hallId' => 'asc', 'date' => 'asc'])]
class ScheduleItem
{
    public const CLEANING_MINUTES = 15;

    #[MongoDB\Id(strategy: 'NONE', type: Type::STRING)]
    private ?string $id = null;

    #[MongoDB\Field(type: Type::STRING)]
    private string $movieId;

    #[MongoDB\Field(type: Type::STRING)]
    private string $movieName;

    #[MongoDB\Field(type: Type::STRING)]
    private string $cinemaId;

    #[MongoDB\Field(type: Type::STRING)]
    private string $cinemaName;

    #[MongoDB\Field(type: Type::STRING)]
    private string $hallId;

    #[MongoDB\Field(type: Type::STRING)]
    private string $hallName;

    #[MongoDB\Field(type: Type::STRING)]
    private string $hallType = '标准厅';

    #[MongoDB\Field(type: Type::STRING)]
    private string $date;

    #[MongoDB\Field(type: Type::STRING)]
    private string $startTime;

    #[MongoDB\Field(type: Type::STRING)]
    private string $endTime;

    #[MongoDB\Field(type: Type::INT)]
    private int $price;

    #[MongoDB\Field(type: Type::INT)]
    private int $seatsTotal;

    #[MongoDB\Field(type: Type::INT)]
    private int $seatsSold = 0;

    #[MongoDB\Field(type: Type::STRING)]
    private string $status = 'planned';

    #[MongoDB\Field(type: Type::FLOAT)]
    private float $weight = 0.5;

    #[MongoDB\Field(type: Type::STRING)]
    private string $language = '国语';

    #[MongoDB\Field(type: Type::STRING)]
    private string $version = '2D';

    #[MongoDB\Field(type: Type::DATE_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new DateTimeImmutable();
    }

    public function toMinutes(string $time): int
    {
        [$h, $m] = explode(':', $time);
        return (int)$h * 60 + (int)$m;
    }

    public function getId(): ?string { return $this->id; }
    public function setId(string $id): self { $this->id = $id; return $this; }
    public function getMovieId(): string { return $this->movieId; }
    public function setMovieId(string $movieId): self { $this->movieId = $movieId; return $this; }
    public function getMovieName(): string { return $this->movieName; }
    public function setMovieName(string $movieName): self { $this->movieName = $movieName; return $this; }
    public function getCinemaId(): string { return $this->cinemaId; }
    public function setCinemaId(string $cinemaId): self { $this->cinemaId = $cinemaId; return $this; }
    public function getCinemaName(): string { return $this->cinemaName; }
    public function setCinemaName(string $cinemaName): self { $this->cinemaName = $cinemaName; return $this; }
    public function getHallId(): string { return $this->hallId; }
    public function setHallId(string $hallId): self { $this->hallId = $hallId; return $this; }
    public function getHallName(): string { return $this->hallName; }
    public function setHallName(string $hallName): self { $this->hallName = $hallName; return $this; }
    public function getDate(): string { return $this->date; }
    public function setDate(string $date): self { $this->date = $date; return $this; }
    public function getStartTime(): string { return $this->startTime; }
    public function setStartTime(string $startTime): self { $this->startTime = $startTime; return $this; }
    public function getEndTime(): string { return $this->endTime; }
    public function setEndTime(string $endTime): self { $this->endTime = $endTime; return $this; }
    public function getPrice(): int { return $this->price; }
    public function setPrice(int $price): self { $this->price = $price; return $this; }
    public function getSeatsTotal(): int { return $this->seatsTotal; }
    public function setSeatsTotal(int $seatsTotal): self { $this->seatsTotal = $seatsTotal; return $this; }
    public function getSeatsSold(): int { return $this->seatsSold; }
    public function setSeatsSold(int $seatsSold): self { $this->seatsSold = $seatsSold; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): self { $this->status = $status; return $this; }
    public function getWeight(): float { return $this->weight; }
    public function setWeight(float $weight): self { $this->weight = $weight; return $this; }
}
