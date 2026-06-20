<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'booth')]
#[ORM\Index(columns: ['exhibition_id', 'status'], name: 'idx_status')]
#[ORM\UniqueConstraint(name: 'uk_exh_code', columns: ['exhibition_id', 'code'])]
class Booth
{
    public const STATUS_AVAILABLE = 'available';
    public const STATUS_RESERVED = 'reserved';
    public const STATUS_CONTRACTED = 'contracted';
    public const STATUS_PAID = 'paid';

    public const STATUSES = [
        self::STATUS_AVAILABLE => '可预订',
        self::STATUS_RESERVED => '已预订',
        self::STATUS_CONTRACTED => '已签约',
        self::STATUS_PAID => '已付款',
    ];

    public const TYPE_STANDARD = 'standard';
    public const TYPE_SPACE = 'space';

    public const TYPE_LABELS = [
        self::TYPE_STANDARD => '标准展位',
        self::TYPE_SPACE => '光地',
    ];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'booths')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Exhibition $exhibition = null;

    #[ORM\Column(length: 30)]
    private ?string $code = null;

    #[ORM\Column(length: 20)]
    private string $type = self::TYPE_STANDARD;

    #[ORM\Column(type: 'decimal', precision: 8, scale: 2)]
    private ?string $area = null;

    #[ORM\Column(length: 20, nullable: true)]
    private ?string $orientation = null;

    #[ORM\Column(type: 'decimal', precision: 10, scale: 2)]
    private ?string $price = null;

    #[ORM\Column(length: 20)]
    private string $status = self::STATUS_AVAILABLE;

    #[ORM\Column(length: 40, nullable: true)]
    private ?string $industry = null;

    #[ORM\Column]
    private int $x = 0;

    #[ORM\Column]
    private int $y = 0;

    #[ORM\Column]
    private int $w = 80;

    #[ORM\Column]
    private int $h = 80;

    #[ORM\ManyToOne]
    private ?Exhibitor $exhibitor = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getExhibition(): ?Exhibition
    {
        return $this->exhibition;
    }

    public function setExhibition(?Exhibition $exhibition): static
    {
        $this->exhibition = $exhibition;

        return $this;
    }

    public function getCode(): ?string
    {
        return $this->code;
    }

    public function setCode(string $code): static
    {
        $this->code = $code;

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

    public function getArea(): ?string
    {
        return $this->area;
    }

    public function setArea(string $area): static
    {
        $this->area = $area;

        return $this;
    }

    public function getOrientation(): ?string
    {
        return $this->orientation;
    }

    public function setOrientation(?string $orientation): static
    {
        $this->orientation = $orientation;

        return $this;
    }

    public function getPrice(): ?string
    {
        return $this->price;
    }

    public function setPrice(string $price): static
    {
        $this->price = $price;

        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): static
    {
        $this->status = $status;

        return $this;
    }

    public function getStatusLabel(): string
    {
        return self::STATUSES[$this->status] ?? $this->status;
    }

    public function getTypeLabel(): string
    {
        return self::TYPE_LABELS[$this->type] ?? $this->type;
    }

    public function getIndustry(): ?string
    {
        return $this->industry;
    }

    public function setIndustry(?string $industry): static
    {
        $this->industry = $industry;

        return $this;
    }

    public function getX(): int
    {
        return $this->x;
    }

    public function setX(int $x): static
    {
        $this->x = $x;

        return $this;
    }

    public function getY(): int
    {
        return $this->y;
    }

    public function setY(int $y): static
    {
        $this->y = $y;

        return $this;
    }

    public function getW(): int
    {
        return $this->w;
    }

    public function setW(int $w): static
    {
        $this->w = $w;

        return $this;
    }

    public function getH(): int
    {
        return $this->h;
    }

    public function setH(int $h): static
    {
        $this->h = $h;

        return $this;
    }

    public function getExhibitor(): ?Exhibitor
    {
        return $this->exhibitor;
    }

    public function setExhibitor(?Exhibitor $exhibitor): static
    {
        $this->exhibitor = $exhibitor;

        return $this;
    }
}
