<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Serializer\Annotation\Groups;

#[MongoDB\Document(collection: 'users')]
#[MongoDB\Index(keys: ['username' => 'asc'], options: ['unique' => true])]
#[MongoDB\Index(keys: ['email' => 'asc'], options: ['unique' => true])]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    public const ROLE_VENUE_ADMIN = 'venue_admin';
    public const ROLE_ORGANIZER = 'organizer';
    public const ROLE_FINANCE = 'finance';
    public const ROLE_AUDIENCE = 'audience';

    #[MongoDB\Id]
    #[Groups(['user:read', 'user:list'])]
    private ?string $id = null;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['user:read', 'user:list', 'auth'])]
    private string $username;

    #[MongoDB\Field(type: 'string')]
    private string $password;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['user:read', 'auth'])]
    private string $name;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['user:read', 'auth'])]
    private string $email;

    #[MongoDB\Field(type: 'string', nullable: true)]
    #[Groups(['user:read'])]
    private ?string $phone = null;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['user:read', 'user:list', 'auth'])]
    private string $role = self::ROLE_AUDIENCE;

    #[MongoDB\Field(type: 'date')]
    #[Groups(['user:read'])]
    private \DateTimeInterface $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTime();
    }

    public function getId(): ?string
    {
        return $this->id;
    }

    public function getUsername(): string
    {
        return $this->username;
    }

    public function setUsername(string $username): self
    {
        $this->username = $username;
        return $this;
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $password): self
    {
        $this->password = $password;
        return $this;
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

    public function getEmail(): string
    {
        return $this->email;
    }

    public function setEmail(string $email): self
    {
        $this->email = $email;
        return $this;
    }

    public function getPhone(): ?string
    {
        return $this->phone;
    }

    public function setPhone(?string $phone): self
    {
        $this->phone = $phone;
        return $this;
    }

    public function getRole(): string
    {
        return $this->role;
    }

    public function setRole(string $role): self
    {
        $this->role = $role;
        return $this;
    }

    public function getRoles(): array
    {
        return ['ROLE_' . strtoupper($this->role)];
    }

    public function getCreatedAt(): \DateTimeInterface
    {
        return $this->createdAt;
    }

    public function eraseCredentials(): void
    {
    }

    public function getUserIdentifier(): string
    {
        return $this->username;
    }
}
