<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Symfony\Component\Serializer\Annotation\Groups;

#[MongoDB\Document(collection: 'performances')]
#[MongoDB\Index(keys: ['venueId' => 1, 'startTime' => 1])]
#[MongoDB\Index(keys: ['status' => 1, 'createdAt' => -1])]
#[MongoDB\Index(keys: ['organizerId' => 1])]
class Performance
{
    public const TYPE_DRAMA = 'drama';
    public const TYPE_CONCERT = 'concert';
    public const TYPE_DANCE = 'dance';
    public const TYPE_OPERA = 'opera';
    public const TYPE_CHILDREN = 'children';

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_NEGOTIATING = 'negotiating';

    #[MongoDB\Id]
    #[Groups(['performance:read', 'performance:list', 'order:read'])]
    private ?string $id = null;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['performance:read', 'performance:list', 'order:read'])]
    private string $name;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['performance:read', 'performance:list'])]
    private string $type;

    #[MongoDB\ReferenceOne(targetDocument: User::class, storeAs: 'id')]
    #[Groups(['performance:read'])]
    private User $organizer;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['performance:read', 'performance:list'])]
    private string $organizerName;

    #[MongoDB\ReferenceOne(targetDocument: Venue::class, storeAs: 'id')]
    #[Groups(['performance:read'])]
    private Venue $venue;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['performance:read', 'performance:list'])]
    private string $venueName;

    #[MongoDB\Field(type: 'int')]
    #[Groups(['performance:read', 'performance:list'])]
    private int $expectedDuration;

    #[MongoDB\Field(type: 'collection')]
    #[Groups(['performance:read'])]
    private array $technicalRequirements = [];

    #[MongoDB\Field(type: 'collection')]
    #[Groups(['performance:read'])]
    private array $expectedDates = [];

    #[MongoDB\Field(type: 'date', nullable: true)]
    #[Groups(['performance:read', 'performance:list'])]
    private ?\DateTimeInterface $startTime = null;

    #[MongoDB\Field(type: 'date', nullable: true)]
    #[Groups(['performance:read', 'performance:list'])]
    private ?\DateTimeInterface $endTime = null;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['performance:read', 'performance:list'])]
    private string $status = self::STATUS_PENDING;

    #[MongoDB\Field(type: 'string', nullable: true)]
    #[Groups(['performance:read'])]
    private ?string $rejectReason = null;

    #[MongoDB\EmbedMany(targetDocument: DeviceRequirement::class)]
    #[Groups(['performance:read'])]
    private Collection $devices;

    #[MongoDB\Field(type: 'date')]
    #[Groups(['performance:read', 'performance:list'])]
    private \DateTimeInterface $createdAt;

    #[MongoDB\Field(type: 'date', nullable: true)]
    #[Groups(['performance:read'])]
    private ?\DateTimeInterface $approvedAt = null;

    public function __construct()
    {
        $this->devices = new ArrayCollection();
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

    public function getOrganizer(): User
    {
        return $this->organizer;
    }

    public function setOrganizer(User $organizer): self
    {
        $this->organizer = $organizer;
        return $this;
    }

    public function getOrganizerName(): string
    {
        return $this->organizerName;
    }

    public function setOrganizerName(string $organizerName): self
    {
        $this->organizerName = $organizerName;
        return $this;
    }

    public function getVenue(): Venue
    {
        return $this->venue;
    }

    public function setVenue(Venue $venue): self
    {
        $this->venue = $venue;
        return $this;
    }

    public function getVenueName(): string
    {
        return $this->venueName;
    }

    public function setVenueName(string $venueName): self
    {
        $this->venueName = $venueName;
        return $this;
    }

    public function getExpectedDuration(): int
    {
        return $this->expectedDuration;
    }

    public function setExpectedDuration(int $expectedDuration): self
    {
        $this->expectedDuration = $expectedDuration;
        return $this;
    }

    public function getTechnicalRequirements(): array
    {
        return $this->technicalRequirements;
    }

    public function setTechnicalRequirements(array $technicalRequirements): self
    {
        $this->technicalRequirements = $technicalRequirements;
        return $this;
    }

    public function getExpectedDates(): array
    {
        return $this->expectedDates;
    }

    public function setExpectedDates(array $expectedDates): self
    {
        $this->expectedDates = $expectedDates;
        return $this;
    }

    public function getStartTime(): ?\DateTimeInterface
    {
        return $this->startTime;
    }

    public function setStartTime(?\DateTimeInterface $startTime): self
    {
        $this->startTime = $startTime;
        return $this;
    }

    public function getEndTime(): ?\DateTimeInterface
    {
        return $this->endTime;
    }

    public function setEndTime(?\DateTimeInterface $endTime): self
    {
        $this->endTime = $endTime;
        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): self
    {
        $this->status = $status;
        return $this;
    }

    public function getRejectReason(): ?string
    {
        return $this->rejectReason;
    }

    public function setRejectReason(?string $rejectReason): self
    {
        $this->rejectReason = $rejectReason;
        return $this;
    }

    public function getDevices(): Collection
    {
        return $this->devices;
    }

    public function addDevice(DeviceRequirement $device): self
    {
        if (!$this->devices->contains($device)) {
            $this->devices->add($device);
        }
        return $this;
    }

    public function removeDevice(DeviceRequirement $device): self
    {
        $this->devices->removeElement($device);
        return $this;
    }

    public function getCreatedAt(): \DateTimeInterface
    {
        return $this->createdAt;
    }

    public function getApprovedAt(): ?\DateTimeInterface
    {
        return $this->approvedAt;
    }

    public function setApprovedAt(?\DateTimeInterface $approvedAt): self
    {
        $this->approvedAt = $approvedAt;
        return $this;
    }
}
