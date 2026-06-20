<?php

namespace App\Security;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Http\Authenticator\AbstractAuthenticator;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Passport;
use Symfony\Component\Security\Http\Authenticator\Passport\SelfValidatingPassport;

class JwtAuthenticator extends AbstractAuthenticator
{
    public function __construct(
        private string $jwtSecret,
        private UserProvider $userProvider
    ) {
    }

    public function supports(Request $request): ?bool
    {
        return $request->headers->has('Authorization');
    }

    public function authenticate(Request $request): Passport
    {
        $authHeader = $request->headers->get('Authorization', '');
        if (!str_starts_with($authHeader, 'Bearer ')) {
            throw new AuthenticationException('缺少 Bearer Token');
        }

        $token = substr($authHeader, 7);

        try {
            $decoded = JWT::decode($token, new Key($this->jwtSecret, 'HS256'));
            $userId = $decoded->sub;
        } catch (\Exception $e) {
            throw new AuthenticationException('Token无效: ' . $e->getMessage());
        }

        return new SelfValidatingPassport(
            new UserBadge($userId, fn(string $identifier) => $this->loadUserFromToken($identifier))
        );
    }

    private function loadUserFromToken(string $userId): SymfonyUser
    {
        try {
            return $this->userProvider->loadUserByIdentifier($userId);
        } catch (\Exception) {
            $demoUsers = [
                'admin' => ['role' => 'management', 'name' => '光影院线', 'avatar' => '院'],
                'manager' => ['role' => 'cinema_manager', 'name' => '影院经理', 'avatar' => '影'],
                'scheduler' => ['role' => 'scheduler', 'name' => '排片员', 'avatar' => '排'],
                'cashier' => ['role' => 'cashier', 'name' => '售票员', 'avatar' => '售'],
                'concession' => ['role' => 'concession_staff', 'name' => '卖品员', 'avatar' => '卖'],
            ];
            $demo = $demoUsers[$userId] ?? ['role' => 'management', 'name' => '演示用户', 'avatar' => '演'];
            return new SymfonyUser(
                id: $userId,
                username: $userId,
                name: $demo['name'],
                role: $demo['role'],
                cinemaId: null,
                avatar: $demo['avatar'],
            );
        }
    }

    public function onAuthenticationSuccess(Request $request, TokenInterface $token, string $firewallName): ?Response
    {
        return null;
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): ?Response
    {
        return new JsonResponse([
            'success' => false,
            'error' => [
                'code' => '401',
                'message' => '认证失败: ' . $exception->getMessage(),
            ],
            'timestamp' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
        ], Response::HTTP_UNAUTHORIZED);
    }
}
