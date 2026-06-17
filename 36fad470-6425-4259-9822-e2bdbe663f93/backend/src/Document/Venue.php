<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Symfony\Component\Serializer\Annotation\Groups;

#[MongoDB\Document(collection: 'venues')]
class Venue
{
    public const TYPE_GRAND_THEATER = 'grand_theater';
    public const TYPE_CONCERT_HALL = 'concert_hall';
    public const TYPE_SMALL_THEATER = 'small_theater';

    #[MongoDB\Id]
    #[Groups(['venue:read', 'venue:list'])]
    private ?string $id = null;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['venue:read', 'venue:list', 'performance:read'])]
    private string $name;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['venue:read', 'venue:list'])]
    private string $type;

    #[MongoDB\Field(type: 'int')]
    #[Groups(['venue:read', 'venue:list'])]
    private int $totalSeats;

    #[MongoDB\Field(type: 'string', nullable: true)]
    #[Groups(['venue:read'])]
    private ?string $description = null;

    #[MongoDB\EmbedMany(targetDocument: SeatSection::class)]
    #[Groups(['venue:read'])]
    private Collection $seatConfig;

    #[MongoDB\Field(type: 'date')]
    #[Groups(['venue:read'])]
    private \DateTimeInterface $createdAt;

    #[MongoDB\Field(type: 'date', nullable: true)]
    private ?\DateTimeInterface $updatedAt = null;

    public function __construct()
    {
        $this->seatConfig = new ArrayCollection();
        $this->createdAt = new \DateTime();
    }

    public function getId(): ?string
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): self
    {
        $this->type = $type;
        return $this;
    }

    public function getTotalSeats(): int
    {
        return $this->totalSeats;
    }

    public function setTotalSeats(int $totalSeats): self
    {
        $this->totalSeats = $totalSeats;
        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): self
    {
        $this->description = $description;
        return $this;
    }

    public function getSeatConfig(): Collection
    {
        return $this->seatConfig;
    }

    public function addSeatConfig(SeatSection $section): self
    {
        if (!$this->seatConfig->contains($section)) {
            $this->seatConfig->add($section);
        }
        return $this;
    }

    public function removeSeatConfig(SeatSection $section): self
    {
        $this->seatConfig->removeElement($section);
        return $this;
    }

    public function setSeatConfig(array $sections): self
    {
        $this->seatConfig = new ArrayCollection($sections);
        return $this;
    }

    public function getCreatedAt(): \DateTimeInterface
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?\DateTimeInterface
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?\DateTimeInterface $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }
}
