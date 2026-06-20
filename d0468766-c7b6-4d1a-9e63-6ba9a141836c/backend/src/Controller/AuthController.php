<?php

namespace App\Controller;

use App\Document\User;
use Doctrine\ODM\MongoDB\DocumentManager;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Routing\Annotation\Method;
use Symfony\Component\Validator\Constraints as Assert;

class AuthController extends AbstractApiController
{
    public function __construct(
        private DocumentManager $dm,
        private string $jwtSecret,
        private int $jwtTtl
    ) {
    }

    #[Route('/api/auth/login', name: 'api_auth_login', methods: ['POST'])]
    public function login(Request $request): JsonResponse
    {
        $body = $this->getJsonBody($request);
        $username = $body['username'] ?? '';
        $password = $body['password'] ?? '';
        $role = $body['role'] ?? null;

        if (empty($username)) {
            return $this->jsonError('用户名不能为空', 400, 'EMPTY_USERNAME');
        }

        $user = $this->dm->getRepository(User::class)->findOneBy(['username' => $username]);
        if (!$user) {
            if ($user = $this->createDemoUser($username, $role));
        }

        if (!$user || !$user->isActive()) {
            return $this->jsonError('用户不存在或已禁用', 401, 'INVALID_CREDENTIALS');
        }

        if ($role && in_array($role, array_keys(User::ROLE_PERMISSIONS))) {
            $user->setRole($role);
            $this->dm->flush();
        }

        $now = time();
        $payload = [
            'iss' => 'guangying-cinema',
            'sub' => $user->getId(),
            'iat' => $now,
            'exp' => $now + $this->jwtTtl,
            'username' => $user->getUsername(),
            'name' => $user->getName(),
            'role' => $user->getRole(),
            'cinemaId' => $user->getCinemaId(),
            'allowedRoutes' => $user->getAllowedRoutes(),
        ];

        $token = JWT::encode($payload, $this->jwtSecret, 'HS256');

        return $this->jsonSuccess([
            'token' => $token,
            'user' => [
                'id' => $user->getId(),
                'username' => $user->getUsername(),
                'name' => $user->getName(),
                'role' => $user->getRole(),
                'cinemaId' => $user->getCinemaId(),
                'avatar' => $user->getAvatar(),
                'allowedRoutes' => $user->getAllowedRoutes(),
            ],
        ]);
    }

    #[Route('/api/auth/me', name: 'api_auth_me', methods: ['GET'])]
    public function me(Request $request): JsonResponse
    {
        $authHeader = $request->headers->get('Authorization');
        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            return $this->jsonError('未登录', 401, 'UNAUTHORIZED');
        }
        $token = substr($authHeader, 7);
        try {
            $decoded = JWT::decode($token, new Key($this->jwtSecret, 'HS256'));
            $userId = $decoded->sub;
            $user = $this->dm->getRepository(User::class)->find($userId);
            if (!$user) {
                return $this->jsonError('用户不存在', 404, 'USER_NOT_FOUND');
            }
            return $this->jsonSuccess([
                'id' => $user->getId(),
                'username' => $user->getUsername(),
                'name' => $user->getName(),
                'role' => $user->getRole(),
                'cinemaId' => $user->getCinemaId(),
                'avatar' => $user->getAvatar(),
                'allowedRoutes' => $user->getAllowedRoutes(),
            ]);
        } catch (\Exception) {
            return $this->jsonError('Token无效', 401, 'INVALID_TOKEN');
        }
    }

    #[Route('/api/auth/switch-role', name: 'api_auth_switch_role', methods: ['POST'])]
    public function switchRole(Request $request): JsonResponse
    {
        $body = $this->getJsonBody($request);
        $role = $body['role'] ?? '';

        if (!isset(User::ROLE_PERMISSIONS[$role])) {
            return $this->jsonError('无效角色', 400, 'INVALID_ROLE');
        }

        return $this->jsonSuccess([
            'role' => $role,
            'allowedRoutes' => User::ROLE_PERMISSIONS[$role],
        ]);
    }

    #[Route('/api/auth/roles', name: 'api_auth_roles', methods: ['GET'])]
    public function getRoles(): JsonResponse
    {
        $meta = [
            User::ROLE_MANAGEMENT => [
                'label' => '院线管理层',
                'description' => '拥有全部模块权限',
                'color' => '#e8b547',
                'avatar' => '👑',
            ],
            User::ROLE_CINEMA_MANAGER => [
                'label' => '影院经理',
                'description' => '管理单影院全部运营',
                'color' => '#4fc3f7',
                'avatar' => '🎬',
            ],
            User::ROLE_SCHEDULER => [
                'label' => '排片员',
                'description' => '排片、DCP、数据分析',
                'color' => '#ce93d8',
                'avatar' => '📅',
            ],
            User::ROLE_CASHIER => [
                'label' => '售票员',
                'description' => '选座、会员',
                'color' => '#81c784',
                'avatar' => '🎟️',
            ],
            User::ROLE_CONCESSION_STAFF => [
                'label' => '卖品员',
                'description' => '卖品进销存',
                'color' => '#ffb74d',
                'avatar' => '🍿',
            ],
        ];

        $roles = [];
        foreach (User::ROLE_PERMISSIONS as $role => $routes) {
            $roles[] = [
                'role' => $role,
                'label' => $meta[$role]['label'],
                'description' => $meta[$role]['description'],
                'color' => $meta[$role]['color'],
                'avatar' => $meta[$role]['avatar'],
                'allowedRoutes' => $routes,
            ];
        }

        return $this->jsonSuccess($roles);
    }

    private function createDemoUser(string $username, ?string $role): ?User
    {
        $demo = [
            'admin' => [User::ROLE_MANAGEMENT, '光影院线'],
            'manager' => [User::ROLE_CINEMA_MANAGER, '影院经理'],
            'scheduler' => [User::ROLE_SCHEDULER, '排片员'],
            'cashier' => [User::ROLE_CASHIER, '售票员'],
            'concession' => [User::ROLE_CONCESSION_STAFF, '卖品员'],
        ];

        if (!isset($demo[$username])) {
            return null;
        }

        [$userRole, $name] = $demo[$username];
        $user = new User();
        $user->setId($username);
        $user->setUsername($username);
        $user->setName($name);
        $user->setRole($role ?? $userRole);
        $user->setPasswordHash(password_hash('123456', PASSWORD_BCRYPT));
        $user->setAvatar(mb_substr($name, 0, 1));
        $this->dm->persist($user);
        $this->dm->flush();
        return $user;
    }
}
