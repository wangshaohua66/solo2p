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

    public const GENDERS = ['male' => '男', 'female' => '女', 'other' => '其他'];
    public const REGIONS = ['华东', '华南', '华北', '华中', '西南', '西北', '东北', '境外'];
    public const POSITIONS = ['CEO/总经理', '部门经理', '主管', '工程师/设计师', '采购', '销售/市场', '学生', '其他'];
    public const VISITOR_INDUSTRIES = ['汽车', '家居家装', '服装纺织', '食品饮料', '机械装备', '电子科技', '商贸流通', '媒体', '政府/协会', '其他'];
    public const AGE_GROUPS = ['18-25', '26-35', '36-45', '46-55', '56+'];

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

    #[ORM\Column(length: 10, nullable: true)]
    private ?string $ageGroup = null;

    #[ORM\Column(length: 10, nullable: true)]
    private ?string $gender = null;

    #[ORM\Column(length: 120, nullable: true)]
    private ?string $company = null;

    #[ORM\Column(length: 40, nullable: true)]
    private ?string $position = null;

    #[ORM\Column(length: 40, nullable: true)]
    private ?string $industry = null;

    #[ORM\Column(length: 20, nullable: true)]
    private ?string $region = null;

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

    public function getAgeGroup(): ?string { return $this->ageGroup; }
    public function setAgeGroup(?string $ageGroup): static { $this->ageGroup = $ageGroup; return $this; }

    public function getGender(): ?string { return $this->gender; }
    public function getGenderLabel(): string { return self::GENDERS[$this->gender] ?? '-'; }
    public function setGender(?string $gender): static { $this->gender = $gender; return $this; }

    public function getCompany(): ?string { return $this->company; }
    public function setCompany(?string $company): static { $this->company = $company; return $this; }

    public function getPosition(): ?string { return $this->position; }
    public function setPosition(?string $position): static { $this->position = $position; return $this; }

    public function getIndustry(): ?string { return $this->industry; }
    public function setIndustry(?string $industry): static { $this->industry = $industry; return $this; }

    public function getRegion(): ?string { return $this->region; }
    public function setRegion(?string $region): static { $this->region = $region; return $this; }
}
