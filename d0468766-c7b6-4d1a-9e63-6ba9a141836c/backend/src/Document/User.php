<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Doctrine\ODM\MongoDB\Types\Type;
use DateTimeImmutable;

#[MongoDB\Document(collection: 'users')]
class User
{
    public const ROLE_MANAGEMENT = 'management';
    public const ROLE_CINEMA_MANAGER = 'cinema_manager';
    public const ROLE_SCHEDULER = 'scheduler';
    public const ROLE_CASHIER = 'cashier';
    public const ROLE_CONCESSION_STAFF = 'concession_staff';

    public const ROLE_PERMISSIONS = [
        self::ROLE_MANAGEMENT => ['/dashboard', '/schedule', '/booking', '/dcp', '/member', '/concession', '/analytics', '/monitor'],
        self::ROLE_CINEMA_MANAGER => ['/dashboard', '/schedule', '/booking', '/member', '/concession', '/analytics', '/monitor'],
        self::ROLE_SCHEDULER => ['/schedule', '/dcp', '/analytics'],
        self::ROLE_CASHIER => ['/booking', '/member'],
        self::ROLE_CONCESSION_STAFF => ['/concession'],
    ];

    #[MongoDB\Id(strategy: 'NONE', type: Type::STRING)]
    private ?string $id = null;

    #[MongoDB\Field(type: Type::STRING)]
    private string $username;

    #[MongoDB\Field(type: Type::STRING)]
    private string $name;

    #[MongoDB\Field(type: Type::STRING)]
    private string $passwordHash;

    #[MongoDB\Field(type: Type::STRING, enumType: Type::STRING)]
    private string $role = self::ROLE_CASHIER;

    #[MongoDB\Field(type: Type::STRING, nullable: true)]
    private ?string $cinemaId = null;

    #[MongoDB\Field(type: Type::STRING)]
    private string $avatar;

    #[MongoDB\Field(type: Type::BOOL)]
    private bool $active = true;

    #[MongoDB\Field(type: Type::DATE_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new DateTimeImmutable();
    }

    public function getAllowedRoutes(): array
    {
        return self::ROLE_PERMISSIONS[$this->role] ?? [];
    }

    public function canAccess(string $route): bool
    {
        return in_array($route, $this->getAllowedRoutes(), true);
    }

    public function getId(): ?string { return $this->id; }
    public function setId(string $id): self { $this->id = $id; return $this; }
    public function getUsername(): string { return $this->username; }
    public function setUsername(string $username): self { $this->username = $username; return $this; }
    public function getName(): string { return $this->name; }
    public function setName(string $name): self { $this->name = $name; return $this; }
    public function getPasswordHash(): string { return $this->passwordHash; }
    public function setPasswordHash(string $passwordHash): self { $this->passwordHash = $passwordHash; return $this; }
    public function getRole(): string { return $this->role; }
    public function setRole(string $role): self { $this->role = $role; return $this; }
    public function getCinemaId(): ?string { return $this->cinemaId; }
    public function setCinemaId(?string $cinemaId): self { $this->cinemaId = $cinemaId; return $this; }
    public function isActive(): bool { return $this->active; }
    public function setActive(bool $active): self { $this->active = $active; return $this; }
}
