<?php

namespace App\Security;

use App\Document\User;
use Symfony\Component\Security\Core\User\UserInterface;

class SymfonyUser implements UserInterface
{
    public function __construct(
        private readonly string $id,
        private readonly string $username,
        private readonly string $name,
        private readonly string $role,
        private readonly ?string $cinemaId,
        private readonly string $avatar,
    ) {
    }

    public function getRoles(): array
    {
        return ['ROLE_USER', 'ROLE_' . strtoupper($this->role)];
    }

    public function getUserIdentifier(): string
    {
        return $this->username;
    }

    public function eraseCredentials(): void
    {
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getUsername(): string
    {
        return $this->username;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getRole(): string
    {
        return $this->role;
    }

    public function getCinemaId(): ?string
    {
        return $this->cinemaId;
    }

    public function getAvatar(): string
    {
        return $this->avatar;
    }

    public function getAllowedRoutes(): array
    {
        return User::ROLE_PERMISSIONS[$this->role] ?? [];
    }

    public function canAccess(string $route): bool
    {
        return in_array($route, $this->getAllowedRoutes(), true);
    }
}
