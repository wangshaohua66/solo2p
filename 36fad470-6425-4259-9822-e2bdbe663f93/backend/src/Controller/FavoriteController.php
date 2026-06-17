<?php

namespace App\Controller;

use App\Document\Favorite;
use App\Document\Performance;
use App\Document\User;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/favorites')]
class FavoriteController extends AbstractController
{
    private DocumentManager $dm;
    private SerializerInterface $serializer;

    public function __construct(
        DocumentManager $dm,
        SerializerInterface $serializer
    ) {
        $this->dm = $dm;
        $this->serializer = $serializer;
    }

    #[Route('', name: 'api_favorites_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $user = $this->getUser();
        $page = (int) $request->query->get('page', 1);
        $pageSize = (int) $request->query->get('pageSize', 20);

        $qb = $this->dm->getRepository(Favorite::class)->createQueryBuilder()
            ->field('userId')->equals($user->getId())
            ->sort('createdAt', 'desc')
            ->skip(($page - 1) * $pageSize)
            ->limit($pageSize);

        $favorites = $qb->getQuery()->toArray();
        $total = $this->dm->getRepository(Favorite::class)->createQueryBuilder()
            ->field('userId')->equals($user->getId())
            ->count()
            ->getQuery()
            ->execute();

        return new JsonResponse([
            'favorites' => json_decode($this->serializer->serialize(
                $favorites,
                'json',
                ['groups' => ['favorite:read']]
            ), true),
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize
        ]);
    }

    #[Route('/add', name: 'api_favorites_add', methods: ['POST'])]
    public function add(Request $request): JsonResponse
    {
        $user = $this->getUser();
        $data = json_decode($request->getContent(), true);
        $performanceId = $data['performanceId'] ?? null;

        if (!$performanceId) {
            return new JsonResponse(['message' => '演出ID不能为空'], 400);
        }

        $performance = $this->dm->getRepository(Performance::class)->find($performanceId);
        if (!$performance) {
            return new JsonResponse(['message' => '演出不存在'], 404);
        }

        $existing = $this->dm->getRepository(Favorite::class)->findOneBy([
            'userId' => $user->getId(),
            'performanceId' => $performanceId
        ]);

        if ($existing) {
            return new JsonResponse(['message' => '已收藏该演出'], 400);
        }

        $favorite = new Favorite();
        $favorite->setUserId($user->getId());
        $favorite->setPerformanceId($performanceId);
        $favorite->setPerformanceName($performance->getName());

        $this->dm->persist($favorite);
        $this->dm->flush();

        return new JsonResponse([
            'message' => '收藏成功',
            'favorite' => json_decode($this->serializer->serialize(
                $favorite,
                'json',
                ['groups' => ['favorite:read']]
            ), true)
        ]);
    }

    #[Route('/remove', name: 'api_favorites_remove', methods: ['POST'])]
    public function remove(Request $request): JsonResponse
    {
        $user = $this->getUser();
        $data = json_decode($request->getContent(), true);
        $performanceId = $data['performanceId'] ?? null;

        if (!$performanceId) {
            return new JsonResponse(['message' => '演出ID不能为空'], 400);
        }

        $favorite = $this->dm->getRepository(Favorite::class)->findOneBy([
            'userId' => $user->getId(),
            'performanceId' => $performanceId
        ]);

        if (!$favorite) {
            return new JsonResponse(['message' => '未收藏该演出'], 404);
        }

        $this->dm->remove($favorite);
        $this->dm->flush();

        return new JsonResponse(['message' => '已取消收藏']);
    }

    #[Route('/check/{performanceId}', name: 'api_favorites_check', methods: ['GET'])]
    public function check(string $performanceId): JsonResponse
    {
        $user = $this->getUser();

        $favorite = $this->dm->getRepository(Favorite::class)->findOneBy([
            'userId' => $user->getId(),
            'performanceId' => $performanceId
        ]);

        return new JsonResponse([
            'isFavorited' => $favorite !== null,
            'favoriteId' => $favorite?->getId()
        ]);
    }
}
