<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'satisfaction_survey')]
#[ORM\HasLifecycleCallbacks]
class SatisfactionSurvey
{
    public const DIMENSIONS = ['venue' => '场馆设施', 'service' => '现场服务', 'organization' => '组织协调', 'traffic' => '客流组织', 'overall' => '总体满意度'];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private ?Exhibition $exhibition = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private ?Exhibitor $exhibitor = null;

    #[ORM\Column(type: 'smallint')]
    private int $venue = 0;

    #[ORM\Column(type: 'smallint')]
    private int $service = 0;

    #[ORM\Column(type: 'smallint')]
    private int $organization = 0;

    #[ORM\Column(type: 'smallint')]
    private int $traffic = 0;

    #[ORM\Column(type: 'smallint')]
    private int $overall = 0;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $feedback = null;

    #[ORM\Column]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\PrePersist]
    public function touchCreatedAt(): void
    {
        $this->createdAt ??= new \DateTimeImmutable();
    }

    public function getAverageScore(): float
    {
        return round(($this->venue + $this->service + $this->organization + $this->traffic + $this->overall) / 5, 2);
    }

    public function getId(): ?int { return $this->id; }

    public function getExhibition(): ?Exhibition { return $this->exhibition; }
    public function setExhibition(?Exhibition $exhibition): static { $this->exhibition = $exhibition; return $this; }

    public function getExhibitor(): ?Exhibitor { return $this->exhibitor; }
    public function setExhibitor(?Exhibitor $exhibitor): static { $this->exhibitor = $exhibitor; return $this; }

    public function getVenue(): int { return $this->venue; }
    public function setVenue(int $venue): static { $this->venue = $venue; return $this; }

    public function getService(): int { return $this->service; }
    public function setService(int $service): static { $this->service = $service; return $this; }

    public function getOrganization(): int { return $this->organization; }
    public function setOrganization(int $organization): static { $this->organization = $organization; return $this; }

    public function getTraffic(): int { return $this->traffic; }
    public function setTraffic(int $traffic): static { $this->traffic = $traffic; return $this; }

    public function getOverall(): int { return $this->overall; }
    public function setOverall(int $overall): static { $this->overall = $overall; return $this; }

    public function getFeedback(): ?string { return $this->feedback; }
    public function setFeedback(?string $feedback): static { $this->feedback = $feedback; return $this; }

    public function getCreatedAt(): ?\DateTimeImmutable { return $this->createdAt; }
}
