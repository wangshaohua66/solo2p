<?php

namespace App\Controller;

use App\Document\Movie;
use App\Service\SchedulingWeightService;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class MovieController extends AbstractApiController
{
    public function __construct(
        private DocumentManager $dm,
        private SchedulingWeightService $weightService
    ) {
    }

    #[Route('/api/movies', name: 'api_movie_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $status = $request->query->get('status');
        $genre = $request->query->get('genre');
        $keyword = $request->query->get('keyword');

        $qb = $this->dm->createQueryBuilder(Movie::class);

        if ($status) {
            $qb->field('status')->equals($status);
        }
        if ($genre) {
            $qb->field('genre')->equals($genre);
        }
        if ($keyword) {
            $qb->addOr(
                $qb->expr()->field('name')->equals(new \MongoDB\BSON\Regex($keyword, 'i')),
                $qb->expr()->field('description')->equals(new \MongoDB\BSON\Regex($keyword, 'i'))
            );
        }

        $qb->sort('boxOffice', 'desc');
        $cursor = $qb->getQuery()->execute();

        $items = [];
        foreach ($cursor as $m) {
            $items[] = $this->serializeMovie($m);
        }

        return $this->jsonSuccess(['items' => $items, 'total' => count($items)]);
    }

    #[Route('/api/movies/{id}', name: 'api_movie_detail', methods: ['GET'])]
    public function detail(string $id): JsonResponse
    {
        $movie = $this->dm->getRepository(Movie::class)->find($id);
        if (!$movie) {
            return $this->jsonError('影片不存在', 404, 'NOT_FOUND');
        }
        return $this->jsonSuccess($this->serializeMovie($movie, true));
    }

    #[Route('/api/movies', name: 'api_movie_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $body = $this->getJsonBody($request);

        $required = ['name', 'duration', 'genre', 'releaseDate'];
        foreach ($required as $k) {
            if (!isset($body[$k])) {
                return $this->jsonError('缺少必要字段: ' . $k, 400, 'MISSING_FIELD');
            }
        }

        $movie = new Movie();
        $movie->setId($body['id'] ?? uniqid('mv_', true));
        $movie->setName($body['name']);
        $movie->setPoster($body['poster'] ?? '');
        $movie->setDuration((int)$body['duration']);
        $movie->setGenre($body['genre']);
        $movie->setReleaseDate(new \DateTimeImmutable($body['releaseDate']));
        $movie->setRating((float)($body['rating'] ?? 0));
        $movie->setBoxOffice((int)($body['boxOffice'] ?? 0));
        $movie->setDcpCount((int)($body['dcpCount'] ?? 0));
        $movie->setStatus($body['status'] ?? '即将上映');
        $movie->setWantSee((int)($body['wantSee'] ?? 0));
        $movie->setDescription($body['description'] ?? '');
        $movie->setDirectors($body['directors'] ?? []);
        $movie->setActors($body['actors'] ?? []);

        $weight = $this->weightService->calculate($movie);
        $movie->setSchedulingWeight($weight['weight']);

        $this->dm->persist($movie);
        $this->dm->flush();

        return $this->jsonSuccess($this->serializeMovie($movie), 201);
    }

    #[Route('/api/movies/{id}', name: 'api_movie_update', methods: ['PUT'])]
    public function update(string $id, Request $request): JsonResponse
    {
        $movie = $this->dm->getRepository(Movie::class)->find($id);
        if (!$movie) {
            return $this->jsonError('影片不存在', 404, 'NOT_FOUND');
        }

        $body = $this->getJsonBody($request);

        if (isset($body['name'])) $movie->setName($body['name']);
        if (isset($body['poster'])) $movie->setPoster($body['poster']);
        if (isset($body['duration'])) $movie->setDuration((int)$body['duration']);
        if (isset($body['genre'])) $movie->setGenre($body['genre']);
        if (isset($body['releaseDate'])) $movie->setReleaseDate(new \DateTimeImmutable($body['releaseDate']));
        if (isset($body['rating'])) $movie->setRating((float)$body['rating']);
        if (isset($body['boxOffice'])) $movie->setBoxOffice((int)$body['boxOffice']);
        if (isset($body['dcpCount'])) $movie->setDcpCount((int)$body['dcpCount']);
        if (isset($body['status'])) $movie->setStatus($body['status']);
        if (isset($body['wantSee'])) $movie->setWantSee((int)$body['wantSee']);
        if (isset($body['description'])) $movie->setDescription($body['description']);
        if (isset($body['directors'])) $movie->setDirectors($body['directors']);
        if (isset($body['actors'])) $movie->setActors($body['actors']);

        $weight = $this->weightService->calculate($movie);
        $movie->setSchedulingWeight($weight['weight']);

        $this->dm->flush();

        return $this->jsonSuccess($this->serializeMovie($movie));
    }

    #[Route('/api/movies/{id}', name: 'api_movie_delete', methods: ['DELETE'])]
    public function delete(string $id): JsonResponse
    {
        $movie = $this->dm->getRepository(Movie::class)->find($id);
        if (!$movie) {
            return $this->jsonError('影片不存在', 404, 'NOT_FOUND');
        }
        $this->dm->remove($movie);
        $this->dm->flush();
        return $this->jsonSuccess(['deleted' => true, 'id' => $id]);
    }

    private function serializeMovie(Movie $m, bool $detail = false): array
    {
        $weight = $this->weightService->calculate($m);
        $data = [
            'id' => $m->getId(),
            'name' => $m->getName(),
            'poster' => $m->getPoster(),
            'duration' => $m->getDuration(),
            'genre' => $m->getGenre(),
            'releaseDate' => $m->getReleaseDate()->format('Y-m-d'),
            'rating' => $m->getRating(),
            'boxOffice' => $m->getBoxOffice(),
            'dcpCount' => $m->getDcpCount(),
            'status' => $m->getStatus(),
            'wantSee' => $m->getWantSee(),
            'schedulingWeight' => $weight['weight'],
            'weightComponents' => [
                'boxOffice' => $weight['boxOfficeScore'],
                'rating' => $weight['ratingScore'],
                'duration' => $weight['durationScore'],
                'decay' => $weight['decayScore'],
            ],
        ];
        if ($detail) {
            $data['description'] = $m->getDescription();
            $data['directors'] = $m->getDirectors();
            $data['actors'] = $m->getActors();
        }
        return $data;
    }
}
