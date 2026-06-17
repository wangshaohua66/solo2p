<?php

namespace App\Controller;

use App\Document\SeatSection;
use App\Document\User;
use App\Document\Venue;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/venues')]
class VenueController extends AbstractController
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

    #[Route('', name: 'api_venues_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $qb = $this->dm->getRepository(Venue::class)->createQueryBuilder();
        $qb->sort('name', 'asc');
        $venues = $qb->getQuery()->toArray();

        return new JsonResponse([
            'venues' => json_decode($this->serializer->serialize(
                $venues,
                'json',
                ['groups' => ['venue:list']]
            ), true),
            'total' => count($venues)
        ]);
    }

    #[Route('/{id}', name: 'api_venues_show', methods: ['GET'])]
    public function show(string $id): JsonResponse
    {
        $venue = $this->dm->getRepository(Venue::class)->find($id);
        if (!$venue) {
            return new JsonResponse(['message' => '场馆不存在'], 404);
        }

        return new JsonResponse([
            'venue' => json_decode($this->serializer->serialize(
                $venue,
                'json',
                ['groups' => ['venue:read']]
            ), true)
        ]);
    }

    #[Route('/{id}/seat-config', name: 'api_venues_seat_config_update', methods: ['PUT'])]
    public function updateSeatConfig(string $id, Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user || $user->getRole() !== User::ROLE_VENUE_ADMIN) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $venue = $this->dm->getRepository(Venue::class)->find($id);
        if (!$venue) {
            return new JsonResponse(['message' => '场馆不存在'], 404);
        }

        $data = json_decode($request->getContent(), true);
        $rawSections = $data['sections'] ?? [];

        $newSections = [];
        $totalSeats = 0;

        foreach ($rawSections as $rawSection) {
            $section = new SeatSection();

            if (!empty($rawSection['id'])) {
                $section->setId($rawSection['id']);
            }

            $section->setName($rawSection['name']);
            $section->setType($rawSection['type'] ?? SeatSection::TYPE_POOL);
            $section->setRows((int)($rawSection['rows'] ?? 0));
            $section->setColumns((int)($rawSection['columns'] ?? 0));
            $section->setStartRow((int)($rawSection['startRow'] ?? 1));
            $section->setStartColumn((int)($rawSection['startColumn'] ?? 1));
            $section->setNumberingRule($rawSection['numberingRule'] ?? SeatSection::NUMBERING_ROW_BASED);
            $section->setBasePrice((float)($rawSection['basePrice'] ?? 0));
            $section->setDisabledForTypes($rawSection['disabledForTypes'] ?? []);

            $totalSeats += $section->getRows() * $section->getColumns();
            $newSections[] = $section;
        }

        $venue->setSeatConfig($newSections);
        $venue->setTotalSeats($totalSeats);
        $venue->setUpdatedAt(new \DateTime());

        $this->dm->flush();

        return new JsonResponse([
            'message' => '座位配置已保存',
            'venue' => json_decode($this->serializer->serialize(
                $venue,
                'json',
                ['groups' => ['venue:read']]
            ), true)
        ]);
    }

    #[Route('', name: 'api_venues_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user || $user->getRole() !== User::ROLE_VENUE_ADMIN) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $data = json_decode($request->getContent(), true);

        $venue = new Venue();
        $venue->setName($data['name']);
        $venue->setType($data['type'] ?? Venue::TYPE_SMALL_THEATER);
        $venue->setTotalSeats((int)($data['totalSeats'] ?? 0));
        $venue->setDescription($data['description'] ?? null);

        $this->dm->persist($venue);
        $this->dm->flush();

        return new JsonResponse([
            'message' => '场馆已创建',
            'venue' => json_decode($this->serializer->serialize(
                $venue,
                'json',
                ['groups' => ['venue:read']]
            ), true)
        ], 201);
    }

    #[Route('/{id}', name: 'api_venues_update', methods: ['PUT'])]
    public function update(string $id, Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user || $user->getRole() !== User::ROLE_VENUE_ADMIN) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $venue = $this->dm->getRepository(Venue::class)->find($id);
        if (!$venue) {
            return new JsonResponse(['message' => '场馆不存在'], 404);
        }

        $data = json_decode($request->getContent(), true);

        if (isset($data['name'])) {
            $venue->setName($data['name']);
        }
        if (isset($data['type'])) {
            $venue->setType($data['type']);
        }
        if (isset($data['totalSeats'])) {
            $venue->setTotalSeats((int)$data['totalSeats']);
        }
        if (isset($data['description'])) {
            $venue->setDescription($data['description']);
        }
        $venue->setUpdatedAt(new \DateTime());

        $this->dm->flush();

        return new JsonResponse([
            'message' => '场馆信息已更新',
            'venue' => json_decode($this->serializer->serialize(
                $venue,
                'json',
                ['groups' => ['venue:read']]
            ), true)
        ]);
    }

    #[Route('/{id}', name: 'api_venues_delete', methods: ['DELETE'])]
    public function delete(string $id): JsonResponse
    {
        $user = $this->getUser();
        if (!$user || $user->getRole() !== User::ROLE_VENUE_ADMIN) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $venue = $this->dm->getRepository(Venue::class)->find($id);
        if (!$venue) {
            return new JsonResponse(['message' => '场馆不存在'], 404);
        }

        $this->dm->remove($venue);
        $this->dm->flush();

        return new JsonResponse([
            'message' => '场馆已删除'
        ]);
    }
}
