<?php

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'exhibition')]
#[ORM\HasLifecycleCallbacks]
class Exhibition
{
    public const STATUS_PREPARING = 'preparing';
    public const STATUS_RECRUITING = 'recruiting';
    public const STATUS_ONGOING = 'ongoing';
    public const STATUS_ENDED = 'ended';

    public const STATUSES = [
        self::STATUS_PREPARING => '筹备中',
        self::STATUS_RECRUITING => '招商中',
        self::STATUS_ONGOING => '进行中',
        self::STATUS_ENDED => '已结束',
    ];

    public const TYPES = ['汽车展', '家装展', '服装展', '食品展', '机械展', '综合展'];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 120)]
    private ?string $name = null;

    #[ORM\Column(length: 40)]
    private ?string $type = null;

    #[ORM\Column(type: 'date')]
    private ?\DateTimeInterface $startDate = null;

    #[ORM\Column(type: 'date')]
    private ?\DateTimeInterface $endDate = null;

    #[ORM\Column(length: 60)]
    private ?string $hall = null;

    #[ORM\Column(length: 20)]
    private string $status = self::STATUS_PREPARING;

    #[ORM\Column]
    private ?\DateTimeImmutable $createdAt = null;

    /**
     * @var Collection<int, Booth>
     */
    #[ORM\OneToMany(mappedBy: 'exhibition', targetEntity: Booth::class)]
    private Collection $booths;

    public function __construct()
    {
        $this->booths = new ArrayCollection();
    }

    #[ORM\PrePersist]
    public function touchCreatedAt(): void
    {
        $this->createdAt ??= new \DateTimeImmutable();
    }

    /**
     * @return Collection<int, Booth>
     */
    public function getBooths(): Collection
    {
        return $this->booths;
    }

    public function getId(): ?int
    {
        return $this->id;
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

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setType(string $type): static
    {
        $this->type = $type;

        return $this;
    }

    public function getStartDate(): ?\DateTimeInterface
    {
        return $this->startDate;
    }

    public function setStartDate(\DateTimeInterface $startDate): static
    {
        $this->startDate = $startDate;

        return $this;
    }

    public function getEndDate(): ?\DateTimeInterface
    {
        return $this->endDate;
    }

    public function setEndDate(\DateTimeInterface $endDate): static
    {
        $this->endDate = $endDate;

        return $this;
    }

    public function getHall(): ?string
    {
        return $this->hall;
    }

    public function setHall(string $hall): static
    {
        $this->hall = $hall;

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

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }
}
