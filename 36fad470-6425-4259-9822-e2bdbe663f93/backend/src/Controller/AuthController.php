<?php

namespace App\Controller;

use App\Document\User;
use Doctrine\ODM\MongoDB\DocumentManager;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

#[Route('/api/auth')]
class AuthController extends AbstractController
{
    private DocumentManager $dm;
    private JWTTokenManagerInterface $jwtManager;
    private UserPasswordHasherInterface $passwordHasher;
    private SerializerInterface $serializer;
    private ValidatorInterface $validator;

    public function __construct(
        DocumentManager $dm,
        JWTTokenManagerInterface $jwtManager,
        UserPasswordHasherInterface $passwordHasher,
        SerializerInterface $serializer,
        ValidatorInterface $validator
    ) {
        $this->dm = $dm;
        $this->jwtManager = $jwtManager;
        $this->passwordHasher = $passwordHasher;
        $this->serializer = $serializer;
        $this->validator = $validator;
    }

    #[Route('/login', name: 'api_auth_login', methods: ['POST'])]
    public function login(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $username = $data['username'] ?? '';
        $password = $data['password'] ?? '';

        $user = $this->dm->getRepository(User::class)->findOneBy(['username' => $username]);
        if (!$user) {
            return new JsonResponse(['message' => '用户名或密码错误'], 401);
        }

        if (!$this->passwordHasher->isPasswordValid($user, $password)) {
            return new JsonResponse(['message' => '用户名或密码错误'], 401);
        }

        $accessToken = $this->jwtManager->create($user);

        $refreshToken = JWT::encode(
            [
                'user_id' => $user->getId(),
                'username' => $user->getUsername(),
                'type' => 'refresh',
                'exp' => time() + 604800
            ],
            $this->getParameter('kernel.project_dir') . '/config/jwt/private.pem',
            'RS256'
        );

        return new JsonResponse([
            'accessToken' => $accessToken,
            'refreshToken' => $refreshToken,
            'user' => json_decode($this->serializer->serialize($user, 'json', ['groups' => 'auth']), true)
        ]);
    }

    #[Route('/me', name: 'api_auth_me', methods: ['GET'])]
    public function me(): JsonResponse
    {
        $user = $this->getUser();
        if (!$user) {
            return new JsonResponse(['message' => '未登录'], 401);
        }

        return new JsonResponse([
            'user' => json_decode($this->serializer->serialize($user, 'json', ['groups' => 'auth']), true)
        ]);
    }

    #[Route('/refresh', name: 'api_auth_refresh', methods: ['POST'])]
    public function refresh(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $refreshToken = $data['refreshToken'] ?? '';

        if (!$refreshToken) {
            return new JsonResponse(['message' => '缺少 refresh token'], 400);
        }

        try {
            $publicKeyPath = $this->getParameter('kernel.project_dir') . '/config/jwt/public.pem';
            $decoded = JWT::decode($refreshToken, new Key($publicKeyPath, 'RS256'));

            if ($decoded->type !== 'refresh') {
                return new JsonResponse(['message' => '无效的 token 类型'], 401);
            }

            $user = $this->dm->getRepository(User::class)->find($decoded->user_id);
            if (!$user) {
                return new JsonResponse(['message' => '用户不存在'], 401);
            }

            $accessToken = $this->jwtManager->create($user);

            $newRefreshToken = JWT::encode(
                [
                    'user_id' => $user->getId(),
                    'username' => $user->getUsername(),
                    'type' => 'refresh',
                    'exp' => time() + 604800
                ],
                $this->getParameter('kernel.project_dir') . '/config/jwt/private.pem',
                'RS256'
            );

            return new JsonResponse([
                'accessToken' => $accessToken,
                'refreshToken' => $newRefreshToken
            ]);
        } catch (\Exception $e) {
            return new JsonResponse(['message' => 'Token 已过期或无效'], 401);
        }
    }

    #[Route('/logout', name: 'api_auth_logout', methods: ['POST'])]
    public function logout(): JsonResponse
    {
        return new JsonResponse(['message' => '登出成功']);
    }

    #[Route('/register', name: 'api_auth_register', methods: ['POST'])]
    public function register(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        $existing = $this->dm->getRepository(User::class)->findOneBy([
            '$or' => [
                ['username' => $data['username']],
                ['email' => $data['email']]
            ]
        ]);

        if ($existing) {
            return new JsonResponse(['message' => '用户名或邮箱已存在'], 400);
        }

        $user = new User();
        $user->setUsername($data['username']);
        $user->setEmail($data['email']);
        $user->setName($data['name'] ?? $data['username']);
        $user->setPhone($data['phone'] ?? null);
        $user->setRole($data['role'] ?? User::ROLE_AUDIENCE);
        $user->setPassword($this->passwordHasher->hashPassword($user, $data['password']));

        $errors = $this->validator->validate($user);
        if (count($errors) > 0) {
            $messages = [];
            foreach ($errors as $error) {
                $messages[] = $error->getMessage();
            }
            return new JsonResponse(['message' => implode('; ', $messages)], 400);
        }

        $this->dm->persist($user);
        $this->dm->flush();

        $accessToken = $this->jwtManager->create($user);

        $refreshToken = JWT::encode(
            [
                'user_id' => $user->getId(),
                'username' => $user->getUsername(),
                'type' => 'refresh',
                'exp' => time() + 604800
            ],
            $this->getParameter('kernel.project_dir') . '/config/jwt/private.pem',
            'RS256'
        );

        return new JsonResponse([
            'message' => '注册成功',
            'accessToken' => $accessToken,
            'refreshToken' => $refreshToken,
            'user' => json_decode($this->serializer->serialize($user, 'json', ['groups' => 'auth']), true)
        ], 201);
    }
}
