<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Doctrine\ODM\MongoDB\Types\Type;
use DateTimeImmutable;

#[MongoDB\Document(collection: 'dcp_items')]
class DcpItem
{
    public const STATUS_DELIVERING = 'delivering';
    public const STATUS_RECEIVED = 'received';
    public const STATUS_VERIFIED = 'verified';
    public const STATUS_PLAYING = 'playing';
    public const STATUS_RECALLED = 'recalled';

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
    private string $sourceCinemaId;

    #[MongoDB\Field(type: Type::STRING)]
    private string $sourceCinemaName;

    #[MongoDB\Field(type: Type::STRING)]
    private string $carrier = '自有物流';

    #[MongoDB\Field(type: Type::STRING)]
    private string $trackingNo;

    #[MongoDB\Field(type: Type::STRING)]
    private string $status = self::STATUS_DELIVERING;

    #[MongoDB\Field(type: Type::INT)]
    private int $progress = 0;

    #[MongoDB\Field(type: Type::DATE_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $estimatedArrival = null;

    #[MongoDB\Field(type: Type::DATE_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $receivedAt = null;

    #[MongoDB\Field(type: Type::COLLECTION)]
    private array $logs = [];

    #[MongoDB\Field(type: Type::DATE_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new DateTimeImmutable();
    }

    public function addLog(string $action, string $operator, ?string $note = null): void
    {
        $this->logs[] = [
            'action' => $action,
            'operator' => $operator,
            'note' => $note,
            'timestamp' => (new DateTimeImmutable())->format(DateTimeImmutable::ATOM),
        ];
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
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): self { $this->status = $status; return $this; }
    public function getProgress(): int { return $this->progress; }
    public function setProgress(int $progress): self { $this->progress = $progress; return $this; }
    public function getTrackingNo(): string { return $this->trackingNo; }
    public function setTrackingNo(string $trackingNo): self { $this->trackingNo = $trackingNo; return $this; }
    public function getCarrier(): string { return $this->carrier; }
    public function setCarrier(string $carrier): self { $this->carrier = $carrier; return $this; }
    public function getEstimatedArrival(): ?DateTimeImmutable { return $this->estimatedArrival; }
    public function setEstimatedArrival(?DateTimeImmutable $estimatedArrival): self { $this->estimatedArrival = $estimatedArrival; return $this; }
    public function getReceivedAt(): ?DateTimeImmutable { return $this->receivedAt; }
    public function setReceivedAt(?DateTimeImmutable $receivedAt): self { $this->receivedAt = $receivedAt; return $this; }
    public function getLogs(): array { return $this->logs; }
    public function getSourceCinemaId(): string { return $this->sourceCinemaId; }
    public function setSourceCinemaId(string $sourceCinemaId): self { $this->sourceCinemaId = $sourceCinemaId; return $this; }
    public function getSourceCinemaName(): string { return $this->sourceCinemaName; }
    public function setSourceCinemaName(string $sourceCinemaName): self { $this->sourceCinemaName = $sourceCinemaName; return $this; }
}
