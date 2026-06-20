<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'visitor')]
#[ORM\Index(columns: ['ticket_code'], name: 'idx_code')]
#[ORM\HasLifecycleCallbacks]
class Visitor
{
    public const TYPE_PROFESSIONAL = 'professional';
    public const TYPE_PUBLIC = 'public';

    public const TYPES = [
        self::TYPE_PROFESSIONAL => '专业观众',
        self::TYPE_PUBLIC => '普通观众',
    ];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private ?Exhibition $exhibition = null;

    #[ORM\Column(length: 60, nullable: true)]
    private ?string $name = null;

    #[ORM\Column(length: 30, nullable: true)]
    private ?string $phone = null;

    #[ORM\Column(length: 20)]
    private string $type = self::TYPE_PUBLIC;

    #[ORM\Column(length: 64)]
    private ?string $ticketCode = null;

    #[ORM\Column]
    private bool $checkedIn = false;

    #[ORM\Column]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $checkinAt = null;

    #[ORM\PrePersist]
    public function touchCreatedAt(): void
    {
        $this->createdAt ??= new \DateTimeImmutable();
    }

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

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(?string $name): static
    {
        $this->name = $name;

        return $this;
    }

    public function getPhone(): ?string
    {
        return $this->phone;
    }

    public function setPhone(?string $phone): static
    {
        $this->phone = $phone;

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

    public function getTypeLabel(): string
    {
        return self::TYPES[$this->type] ?? $this->type;
    }

    public function getTicketCode(): ?string
    {
        return $this->ticketCode;
    }

    public function setTicketCode(string $ticketCode): static
    {
        $this->ticketCode = $ticketCode;

        return $this;
    }

    public function isCheckedIn(): bool
    {
        return $this->checkedIn;
    }

    public function setCheckedIn(bool $checkedIn): static
    {
        $this->checkedIn = $checkedIn;

        return $this;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getCheckinAt(): ?\DateTimeImmutable
    {
        return $this->checkinAt;
    }

    public function setCheckinAt(?\DateTimeImmutable $checkinAt): static
    {
        $this->checkinAt = $checkinAt;

        return $this;
    }
}
