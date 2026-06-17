<?php

namespace App\Controller;

use App\Document\User;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api/users')]
class UserController extends AbstractController
{
    private DocumentManager $dm;
    private UserPasswordHasherInterface $passwordHasher;
    private SerializerInterface $serializer;
    private ValidatorInterface $validator;

    public function __construct(
        DocumentManager $dm,
        UserPasswordHasherInterface $passwordHasher,
        SerializerInterface $serializer,
        ValidatorInterface $validator
    ) {
        $this->dm = $dm;
        $this->passwordHasher = $passwordHasher;
        $this->serializer = $serializer;
        $this->validator = $validator;
    }

    #[Route('', name: 'api_users_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user || $user->getRole() !== User::ROLE_VENUE_ADMIN) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $role = $request->query->get('role');

        $qb = $this->dm->getRepository(User::class)->createQueryBuilder();
        if ($role) {
            $qb->field('role')->equals($role);
        }
        $qb->sort('createdAt', 'desc');
        $users = $qb->getQuery()->toArray();

        return new JsonResponse([
            'users' => json_decode($this->serializer->serialize(
                $users,
                'json',
                ['groups' => ['user:list']]
            ), true),
            'total' => count($users)
        ]);
    }

    #[Route('/{id}', name: 'api_users_show', methods: ['GET'])]
    public function show(string $id): JsonResponse
    {
        $currentUser = $this->getUser();
        if (!$currentUser || $currentUser->getRole() !== User::ROLE_VENUE_ADMIN && $currentUser->getId() !== $id) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $user = $this->dm->getRepository(User::class)->find($id);
        if (!$user) {
            return new JsonResponse(['message' => '用户不存在'], 404);
        }

        return new JsonResponse([
            'user' => json_decode($this->serializer->serialize(
                $user,
                'json',
                ['groups' => ['user:read']]
            ), true)
        ]);
    }

    #[Route('', name: 'api_users_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $currentUser = $this->getUser();
        if (!$currentUser || $currentUser->getRole() !== User::ROLE_VENUE_ADMIN) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

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

        if (empty($data['password'])) {
            return new JsonResponse(['message' => '密码不能为空'], 400);
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

        return new JsonResponse([
            'message' => '用户已创建',
            'user' => json_decode($this->serializer->serialize(
                $user,
                'json',
                ['groups' => ['user:read']]
            ), true)
        ], 201);
    }

    #[Route('/{id}', name: 'api_users_update', methods: ['PUT'])]
    public function update(string $id, Request $request): JsonResponse
    {
        $currentUser = $this->getUser();
        if (!$currentUser) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $user = $this->dm->getRepository(User::class)->find($id);
        if (!$user) {
            return new JsonResponse(['message' => '用户不存在'], 404);
        }

        if ($currentUser->getRole() !== User::ROLE_VENUE_ADMIN && $currentUser->getId() !== $id) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $data = json_decode($request->getContent(), true);

        if (isset($data['name'])) {
            $user->setName($data['name']);
        }
        if (isset($data['email'])) {
            $user->setEmail($data['email']);
        }
        if (isset($data['phone'])) {
            $user->setPhone($data['phone']);
        }
        if (isset($data['role']) && $currentUser->getRole() === User::ROLE_VENUE_ADMIN) {
            $user->setRole($data['role']);
        }
        if (!empty($data['password'])) {
            $user->setPassword($this->passwordHasher->hashPassword($user, $data['password']));
        }

        $errors = $this->validator->validate($user);
        if (count($errors) > 0) {
            $messages = [];
            foreach ($errors as $error) {
                $messages[] = $error->getMessage();
            }
            return new JsonResponse(['message' => implode('; ', $messages)], 400);
        }

        $this->dm->flush();

        return new JsonResponse([
            'message' => '用户信息已更新',
            'user' => json_decode($this->serializer->serialize(
                $user,
                'json',
                ['groups' => ['user:read']]
            ), true)
        ]);
    }

    #[Route('/{id}', name: 'api_users_delete', methods: ['DELETE'])]
    public function delete(string $id): JsonResponse
    {
        $currentUser = $this->getUser();
        if (!$currentUser || $currentUser->getRole() !== User::ROLE_VENUE_ADMIN) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $user = $this->dm->getRepository(User::class)->find($id);
        if (!$user) {
            return new JsonResponse(['message' => '用户不存在'], 404);
        }

        if ($user->getRole() === User::ROLE_VENUE_ADMIN) {
            return new JsonResponse(['message' => '不能删除管理员账号'], 400);
        }

        $this->dm->remove($user);
        $this->dm->flush();

        return new JsonResponse([
            'message' => '用户已删除'
        ]);
    }
}
