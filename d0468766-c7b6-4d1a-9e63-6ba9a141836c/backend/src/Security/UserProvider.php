<?php

namespace App\Security;

use App\Document\User;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Component\Security\Core\Exception\UnsupportedUserException;
use Symfony\Component\Security\Core\Exception\UserNotFoundException;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Core\User\UserProviderInterface;

class UserProvider implements UserProviderInterface
{
    public function __construct(private DocumentManager $dm)
    {
    }

    public function loadUserByIdentifier(string $identifier): UserInterface
    {
        $user = $this->dm->getRepository(User::class)->findOneBy(['username' => $identifier]);
        if (!$user) {
            $user = $this->dm->getRepository(User::class)->find($identifier);
        }
        if (!$user) {
            throw new UserNotFoundException(sprintf('用户 "%s" 不存在', $identifier));
        }
        return $this->toSymfonyUser($user);
    }

    public function refreshUser(UserInterface $user): UserInterface
    {
        if (!$user instanceof SymfonyUser) {
            throw new UnsupportedUserException();
        }
        return $this->loadUserByIdentifier($user->getUserIdentifier());
    }

    public function supportsClass(string $class): bool
    {
        return $class === SymfonyUser::class || is_subclass_of($class, UserInterface::class);
    }

    public function toSymfonyUser(User $user): SymfonyUser
    {
        return new SymfonyUser(
            id: $user->getId(),
            username: $user->getUsername(),
            name: $user->getName(),
            role: $user->getRole(),
            cinemaId: $user->getCinemaId(),
            avatar: $user->getAvatar(),
        );
    }
}
