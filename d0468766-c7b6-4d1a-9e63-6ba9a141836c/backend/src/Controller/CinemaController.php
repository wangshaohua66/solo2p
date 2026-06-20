<?php

namespace App\Controller;

use App\Document\Cinema;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class CinemaController extends AbstractApiController
{
    public function __construct(private DocumentManager $dm)
    {
    }

    #[Route('/api/cinemas', name: 'api_cinema_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $status = $request->query->get('status');
        $keyword = $request->query->get('keyword');

        $qb = $this->dm->createQueryBuilder(Cinema::class);

        if ($status) {
            $qb->field('status')->equals($status);
        }
        if ($keyword) {
            $qb->addOr(
                $qb->expr()->field('name')->equals(new \MongoDB\BSON\Regex($keyword, 'i')),
                $qb->expr()->field('address')->equals(new \MongoDB\BSON\Regex($keyword, 'i'))
            );
        }

        $qb->sort('todayBoxOffice', 'desc');
        $cursor = $qb->getQuery()->execute();

        $items = [];
        foreach ($cursor as $c) {
            $items[] = $this->serializeCinema($c);
        }

        return $this->jsonSuccess(['items' => $items, 'total' => count($items)]);
    }

    #[Route('/api/cinemas/{id}', name: 'api_cinema_detail', methods: ['GET'])]
    public function detail(string $id): JsonResponse
    {
        $cinema = $this->dm->getRepository(Cinema::class)->find($id);
        if (!$cinema) {
            return $this->jsonError('影院不存在', 404, 'NOT_FOUND');
        }
        return $this->jsonSuccess($this->serializeCinema($cinema, true));
    }

    #[Route('/api/cinemas', name: 'api_cinema_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $body = $this->getJsonBody($request);

        $required = ['name', 'address', 'phone', 'businessHours', 'halls', 'screens', 'manager'];
        foreach ($required as $k) {
            if (!isset($body[$k])) {
                return $this->jsonError('缺少必要字段: ' . $k, 400, 'MISSING_FIELD');
            }
        }

        $cinema = new Cinema();
        $cinema->setId($body['id'] ?? uniqid('cin_', true));
        $cinema->setName($body['name']);
        $cinema->setAddress($body['address']);
        $cinema->setPhone($body['phone']);
        $cinema->setBusinessHours($body['businessHours']);
        $cinema->setHalls((int)$body['halls']);
        $cinema->setScreens((int)$body['screens']);
        $cinema->setManager($body['manager']);
        $cinema->setStatus($body['status'] ?? 'open');
        $cinema->setTodayBoxOffice((int)($body['todayBoxOffice'] ?? 0));
        $cinema->setTodayAudience((int)($body['todayAudience'] ?? 0));
        $cinema->setTags($body['tags'] ?? []);
        $cinema->setImages($body['images'] ?? []);
        $cinema->setRating((float)($body['rating'] ?? 5.0));

        $this->dm->persist($cinema);
        $this->dm->flush();

        return $this->jsonSuccess($this->serializeCinema($cinema), 201);
    }

    #[Route('/api/cinemas/{id}', name: 'api_cinema_update', methods: ['PUT'])]
    public function update(string $id, Request $request): JsonResponse
    {
        $cinema = $this->dm->getRepository(Cinema::class)->find($id);
        if (!$cinema) {
            return $this->jsonError('影院不存在', 404, 'NOT_FOUND');
        }

        $body = $this->getJsonBody($request);

        if (isset($body['name'])) $cinema->setName($body['name']);
        if (isset($body['address'])) $cinema->setAddress($body['address']);
        if (isset($body['phone'])) $cinema->setPhone($body['phone']);
        if (isset($body['businessHours'])) $cinema->setBusinessHours($body['businessHours']);
        if (isset($body['halls'])) $cinema->setHalls((int)$body['halls']);
        if (isset($body['screens'])) $cinema->setScreens((int)$body['screens']);
        if (isset($body['manager'])) $cinema->setManager($body['manager']);
        if (isset($body['status'])) $cinema->setStatus($body['status']);
        if (isset($body['todayBoxOffice'])) $cinema->setTodayBoxOffice((int)$body['todayBoxOffice']);
        if (isset($body['todayAudience'])) $cinema->setTodayAudience((int)$body['todayAudience']);
        if (isset($body['tags'])) $cinema->setTags($body['tags']);
        if (isset($body['images'])) $cinema->setImages($body['images']);
        if (isset($body['rating'])) $cinema->setRating((float)$body['rating']);

        $this->dm->flush();

        return $this->jsonSuccess($this->serializeCinema($cinema));
    }

    #[Route('/api/cinemas/{id}', name: 'api_cinema_delete', methods: ['DELETE'])]
    public function delete(string $id): JsonResponse
    {
        $cinema = $this->dm->getRepository(Cinema::class)->find($id);
        if (!$cinema) {
            return $this->jsonError('影院不存在', 404, 'NOT_FOUND');
        }
        $this->dm->remove($cinema);
        $this->dm->flush();
        return $this->jsonSuccess(['deleted' => true, 'id' => $id]);
    }

    private function serializeCinema(Cinema $c, bool $detail = false): array
    {
        return [
            'id' => $c->getId(),
            'name' => $c->getName(),
            'address' => $c->getAddress(),
            'phone' => $c->getPhone(),
            'businessHours' => $c->getBusinessHours(),
            'halls' => $c->getHalls(),
            'screens' => $c->getScreens(),
            'manager' => $c->getManager(),
            'status' => $c->getStatus(),
            'todayBoxOffice' => $c->getTodayBoxOffice(),
            'todayAudience' => $c->getTodayAudience(),
            'tags' => $c->getTags(),
            'images' => $c->getImages(),
            'rating' => $c->getRating(),
        ];
    }
}
