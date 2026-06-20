<?php

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'contract')]
#[ORM\HasLifecycleCallbacks]
class Contract
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING_SM = 'pending_sm';
    public const STATUS_PENDING_FINANCE = 'pending_finance';
    public const STATUS_PENDING_GM = 'pending_gm';
    public const STATUS_SIGNED = 'signed';
    public const STATUS_PAID = 'paid';
    public const STATUS_REJECTED = 'rejected';

    public const STATUSES = [
        self::STATUS_DRAFT => '草稿',
        self::STATUS_PENDING_SM => '待销售经理审批',
        self::STATUS_PENDING_FINANCE => '待财务审批',
        self::STATUS_PENDING_GM => '待总经理审批',
        self::STATUS_SIGNED => '已签章',
        self::STATUS_PAID => '已付款',
        self::STATUS_REJECTED => '已驳回',
    ];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 40)]
    private ?string $code = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private ?Exhibition $exhibition = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private ?Exhibitor $exhibitor = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private ?Booth $booth = null;

    #[ORM\Column(type: 'decimal', precision: 12, scale: 2)]
    private ?string $amount = null;

    #[ORM\Column(length: 20)]
    private string $status = self::STATUS_DRAFT;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $signature = null;

    #[ORM\Column]
    private ?\DateTimeImmutable $createdAt = null;

    /**
     * @var Collection<int, ContractLog>
     */
    #[ORM\OneToMany(mappedBy: 'contract', targetEntity: ContractLog::class, orphanRemoval: true)]
    private Collection $logs;

    public function __construct()
    {
        $this->logs = new ArrayCollection();
    }

    #[ORM\PrePersist]
    public function touchCreatedAt(): void
    {
        $this->createdAt ??= new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
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

    public function getExhibition(): ?Exhibition
    {
        return $this->exhibition;
    }

    public function setExhibition(?Exhibition $exhibition): static
    {
        $this->exhibition = $exhibition;

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

    public function getBooth(): ?Booth
    {
        return $this->booth;
    }

    public function setBooth(?Booth $booth): static
    {
        $this->booth = $booth;

        return $this;
    }

    public function getAmount(): ?string
    {
        return $this->amount;
    }

    public function setAmount(string $amount): static
    {
        $this->amount = $amount;

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

    public function getSignature(): ?string
    {
        return $this->signature;
    }

    public function setSignature(?string $signature): static
    {
        $this->signature = $signature;

        return $this;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }

    /**
     * @return Collection<int, ContractLog>
     */
    public function getLogs(): Collection
    {
        return $this->logs;
    }

    public function addLog(ContractLog $log): static
    {
        if (!$this->logs->contains($log)) {
            $this->logs->add($log);
            $log->setContract($this);
        }

        return $this;
    }
}
