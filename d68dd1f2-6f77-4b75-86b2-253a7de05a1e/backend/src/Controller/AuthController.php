<?php

namespace App\Controller;

use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Core\User\UserProviderInterface;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/auth')]
class AuthController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly UserPasswordHasherInterface $passwordHasher,
        private readonly JWTTokenManagerInterface $jwtManager,
        private readonly UserProviderInterface $userProvider,
        private readonly LoggerInterface $logger,
        private readonly SerializerInterface $serializer,
    ) {}

    #[Route('/login', methods: ['POST'])]
    public function login(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $username = trim($body['username'] ?? '');
        $password = (string)($body['password'] ?? '');

        if (empty($username) || empty($password)) {
            return $this->json([
                'success' => false,
                'message' => '用户名和密码不能为空',
            ], 400);
        }

        try {
            $user = $this->userProvider->loadUserByIdentifier($username);
        } catch (\Exception $e) {
            $this->logger->warning('Login attempt - user not found', ['username' => $username]);
            return $this->json([
                'success' => false,
                'message' => '用户名或密码错误',
            ], 401);
        }

        if (!$this->passwordHasher->isPasswordValid($user, $password)) {
            $this->logger->warning('Login attempt - wrong password', [
                'username' => $username,
                'ip' => $request->getClientIp(),
            ]);
            return $this->json([
                'success' => false,
                'message' => '用户名或密码错误',
                'attempts_left' => 5,
            ], 401);
        }

        $token = $this->jwtManager->create($user);
        $refreshToken = bin2hex(random_bytes(32));

        $expireAt = new \DateTimeImmutable('+7 days');
        $this->storeRefreshToken(
            $user->getUserIdentifier(),
            $refreshToken,
            $expireAt
        );

        $roles = method_exists($user, 'getRoles') ? $user->getRoles() : [];

        $json = $this->serializer->serialize($user, 'json', [
            'groups' => ['user:read'],
            'circular_reference_handler' => fn($o) => method_exists($o, 'getId') ? $o->getId() : null,
        ]);

        return $this->json([
            'success' => true,
            'token' => $token,
            'token_type' => 'Bearer',
            'expires_in' => 3600,
            'refresh_token' => $refreshToken,
            'refresh_expires_in' => 604800,
            'user' => json_decode($json, true),
            'roles' => $roles,
            'permissions' => $this->buildPermissions($roles),
            'studio_info' => [
                'name' => '腕表维修服务中心',
                'phone' => '400-800-1234',
                'working_hours' => '9:00 - 18:00（周一至周六）',
            ],
        ]);
    }

    #[Route('/refresh', methods: ['POST'])]
    public function refreshToken(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $refreshToken = $body['refresh_token'] ?? '';

        if (empty($refreshToken)) {
            return $this->json([
                'success' => false,
                'message' => '缺少 refresh token',
            ], 400);
        }

        $stored = $this->verifyRefreshToken($refreshToken);
        if (!$stored) {
            return $this->json([
                'success' => false,
                'message' => 'Refresh token 无效或已过期，请重新登录',
            ], 401);
        }

        try {
            $user = $this->userProvider->loadUserByIdentifier($stored['username']);
        } catch (\Exception $e) {
            return $this->json([
                'success' => false,
                'message' => '用户不存在',
            ], 401);
        }

        $newToken = $this->jwtManager->create($user);
        $newRefresh = bin2hex(random_bytes(32));
        $expireAt = new \DateTimeImmutable('+7 days');

        $this->storeRefreshToken($user->getUserIdentifier(), $newRefresh, $expireAt);
        $this->invalidateRefreshToken($refreshToken);

        return $this->json([
            'success' => true,
            'token' => $newToken,
            'token_type' => 'Bearer',
            'expires_in' => 3600,
            'refresh_token' => $newRefresh,
            'refresh_expires_in' => 604800,
        ]);
    }

    #[Route('/me', methods: ['GET'])]
    public function me(): JsonResponse
    {
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['message' => '未登录'], 401);
        }

        $json = $this->serializer->serialize($user, 'json', [
            'groups' => ['user:read'],
            'circular_reference_handler' => fn($o) => method_exists($o, 'getId') ? $o->getId() : null,
        ]);

        $roles = method_exists($user, 'getRoles') ? $user->getRoles() : [];

        return $this->json([
            'success' => true,
            'user' => json_decode($json, true),
            'roles' => $roles,
            'permissions' => $this->buildPermissions($roles),
        ]);
    }

    #[Route('/logout', methods: ['POST'])]
    public function logout(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        if (!empty($body['refresh_token'])) {
            $this->invalidateRefreshToken($body['refresh_token']);
        }
        return $this->json(['success' => true, 'message' => '退出成功']);
    }

    #[Route('/setup-demo', methods: ['POST'])]
    public function setupDemoUsers(): JsonResponse
    {
        $repo = $this->em->getRepository(\App\Entity\User::class);

        $users = [
            [
                'username' => 'admin',
                'name' => '系统管理员',
                'password' => 'admin123',
                'role' => \App\Entity\User::ROLE_ADMIN,
                'phone' => '13800138000',
                'email' => 'admin@watchstudio.com',
            ],
            [
                'username' => 'manager',
                'name' => '王经理',
                'password' => 'manager123',
                'role' => \App\Entity\User::ROLE_MANAGER,
                'phone' => '13800138001',
                'email' => 'manager@watchstudio.com',
            ],
            [
                'username' => 'tech1',
                'name' => '李师傅',
                'password' => 'tech123',
                'role' => \App\Entity\User::ROLE_TECHNICIAN,
                'phone' => '13800138002',
                'email' => 'tech1@watchstudio.com',
            ],
            [
                'username' => 'tech2',
                'name' => '张师傅',
                'password' => 'tech123',
                'role' => \App\Entity\User::ROLE_TECHNICIAN,
                'phone' => '13800138003',
                'email' => 'tech2@watchstudio.com',
            ],
            [
                'username' => 'reception',
                'name' => '前台小李',
                'password' => 'reception123',
                'role' => \App\Entity\User::ROLE_RECEPTION,
                'phone' => '13800138004',
                'email' => 'reception@watchstudio.com',
            ],
        ];

        $created = 0;
        $skipped = 0;

        foreach ($users as $u) {
            $existing = $repo->findOneBy(['username' => $u['username']]);
            if ($existing) {
                $skipped++;
                continue;
            }

            $user = new \App\Entity\User();
            $user->setUsername($u['username']);
            $user->setName($u['name']);
            $user->setPhone($u['phone']);
            $user->setEmail($u['email']);
            $user->setRole($u['role']);
            $user->setPassword($this->passwordHasher->hashPassword($user, $u['password']));

            $this->em->persist($user);
            $created++;
        }

        $this->em->flush();

        return $this->json([
            'success' => true,
            'created' => $created,
            'skipped' => $skipped,
            'demo_accounts' => array_map(fn($u) => [
                'username' => $u['username'],
                'password' => $u['password'],
                'name' => $u['name'],
                'role' => $u['role'],
            ], $users),
        ]);
    }

    private function buildPermissions(array $roles): array
    {
        $perms = [
            'workorder:view',
            'workorder:create',
            'workorder:edit',
            'workorder:status:quote',
            'customer:view',
            'customer:create',
            'customer:edit',
            'movement:view',
            'dashboard:view',
            'parts:view',
            'report:view',
            'warranty:view',
        ];

        if (in_array('ROLE_ADMIN', $roles, true) || in_array('ROLE_MANAGER', $roles, true)) {
            $perms = array_merge($perms, [
                'workorder:delete',
                'workorder:status:archive',
                'workorder:status:deliver',
                'parts:create',
                'parts:edit',
                'parts:delete',
                'parts:adjust_stock',
                'report:send_email',
                'report:export_pdf',
                'warranty:notify',
                'user:manage',
                'settings:manage',
            ]);
        }

        if (in_array('ROLE_TECHNICIAN', $roles, true)) {
            $perms = array_merge($perms, [
                'workorder:status:start_repair',
                'workorder:status:submit_qa',
                'workorder:inspection:edit',
                'workorder:parts:scan',
                'workorder:images:upload',
            ]);
        }

        if (in_array('ROLE_RECEPTION', $roles, true)) {
            $perms = array_merge($perms, [
                'workorder:status:confirm_quote',
                'workorder:status:ready_pickup',
                'workorder:status:deliver',
            ]);
        }

        return array_unique($perms);
    }

    private function storeRefreshToken(string $username, string $token, \DateTimeImmutable $expireAt): void
    {
        $key = 'auth_refresh_' . hash('sha256', $token);
        $path = sys_get_temp_dir() . '/jwt_refresh_tokens';
        if (!is_dir($path)) {
            @mkdir($path, 0700, true);
        }
        file_put_contents(
            $path . '/' . basename($key),
            json_encode([
                'username' => $username,
                'expire' => $expireAt->format(\DateTimeInterface::ATOM),
                'created' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
            ], JSON_UNESCAPED_UNICODE)
        );
    }

    private function verifyRefreshToken(string $token): ?array
    {
        $key = 'auth_refresh_' . hash('sha256', $token);
        $path = sys_get_temp_dir() . '/jwt_refresh_tokens/' . basename($key);
        if (!file_exists($path)) {
            return null;
        }
        $data = json_decode(file_get_contents($path), true);
        if (!$data || !isset($data['username'])) {
            return null;
        }
        try {
            $expire = new \DateTimeImmutable($data['expire']);
        } catch (\Throwable) {
            return null;
        }
        if ($expire < new \DateTimeImmutable()) {
            @unlink($path);
            return null;
        }
        return $data;
    }

    private function invalidateRefreshToken(string $token): void
    {
        $key = 'auth_refresh_' . hash('sha256', $token);
        $path = sys_get_temp_dir() . '/jwt_refresh_tokens/' . basename($key);
        if (file_exists($path)) {
            @unlink($path);
        }
    }
}
