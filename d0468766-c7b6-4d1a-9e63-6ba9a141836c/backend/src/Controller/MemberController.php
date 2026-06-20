<?php

namespace App\Controller;

use App\Document\Member;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class MemberController extends AbstractApiController
{
    public function __construct(private DocumentManager $dm)
    {
    }

    #[Route('/api/members', name: 'api_member_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $level = $request->query->get('level');
        $keyword = $request->query->get('keyword');
        $cinemaId = $request->query->get('cinemaId');

        $qb = $this->dm->createQueryBuilder(Member::class);

        if ($level) {
            $qb->field('level')->equals($level);
        }
        if ($cinemaId) {
            $qb->field('cinemaId')->equals($cinemaId);
        }
        if ($keyword) {
            $qb->addOr(
                $qb->expr()->field('name')->equals(new \MongoDB\BSON\Regex($keyword, 'i')),
                $qb->expr()->field('phone')->equals(new \MongoDB\BSON\Regex($keyword, 'i'))
            );
        }

        $qb->sort('createdAt', 'desc');
        $cursor = $qb->getQuery()->execute();

        $items = [];
        foreach ($cursor as $m) {
            $items[] = $this->serializeMember($m);
        }

        return $this->jsonSuccess(['items' => $items, 'total' => count($items)]);
    }

    #[Route('/api/members/{id}', name: 'api_member_detail', methods: ['GET'])]
    public function detail(string $id): JsonResponse
    {
        $member = $this->dm->getRepository(Member::class)->find($id);
        if (!$member) {
            return $this->jsonError('会员不存在', 404, 'NOT_FOUND');
        }
        return $this->jsonSuccess($this->serializeMember($member, true));
    }

    #[Route('/api/members', name: 'api_member_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $body = $this->getJsonBody($request);

        $required = ['name', 'phone'];
        foreach ($required as $k) {
            if (!isset($body[$k])) {
                return $this->jsonError('缺少必要字段: ' . $k, 400, 'MISSING_FIELD');
            }
        }

        $exist = $this->dm->getRepository(Member::class)->findOneBy(['phone' => $body['phone']]);
        if ($exist) {
            return $this->jsonError('该手机号已注册', 409, 'PHONE_EXISTS');
        }

        $member = new Member();
        $member->setId($body['id'] ?? uniqid('mb_', true));
        $member->setName($body['name']);
        $member->setPhone($body['phone']);
        $member->setEmail($body['email'] ?? null);
        $member->setBirthday($body['birthday'] ?? null);
        $member->setLevel($body['level'] ?? Member::LEVEL_BRONZE);
        $member->setPoints((int)($body['points'] ?? 0));
        $member->setTotalSpent((int)($body['totalSpent'] ?? 0));
        $member->setWatchCount((int)($body['watchCount'] ?? 0));
        $member->setCouponCount((int)($body['couponCount'] ?? 0));
        $member->setCinemaId($body['cinemaId'] ?? null);
        $member->setStatus($body['status'] ?? 'active');
        $member->setTags($body['tags'] ?? []);
        $member->setPreferredGenres($body['preferredGenres'] ?? []);

        $member->setLevel($member->calculateLevel());

        $this->dm->persist($member);
        $this->dm->flush();

        return $this->jsonSuccess($this->serializeMember($member), 201);
    }

    #[Route('/api/members/{id}', name: 'api_member_update', methods: ['PUT'])]
    public function update(string $id, Request $request): JsonResponse
    {
        $member = $this->dm->getRepository(Member::class)->find($id);
        if (!$member) {
            return $this->jsonError('会员不存在', 404, 'NOT_FOUND');
        }

        $body = $this->getJsonBody($request);

        if (isset($body['name'])) $member->setName($body['name']);
        if (isset($body['phone'])) {
            $exist = $this->dm->getRepository(Member::class)->findOneBy(['phone' => $body['phone']]);
            if ($exist && $exist->getId() !== $id) {
                return $this->jsonError('该手机号已被其他会员使用', 409, 'PHONE_EXISTS');
            }
            $member->setPhone($body['phone']);
        }
        if (isset($body['email'])) $member->setEmail($body['email']);
        if (isset($body['birthday'])) $member->setBirthday($body['birthday']);
        if (isset($body['points'])) $member->setPoints((int)$body['points']);
        if (isset($body['totalSpent'])) $member->setTotalSpent((int)$body['totalSpent']);
        if (isset($body['watchCount'])) $member->setWatchCount((int)$body['watchCount']);
        if (isset($body['couponCount'])) $member->setCouponCount((int)$body['couponCount']);
        if (isset($body['cinemaId'])) $member->setCinemaId($body['cinemaId']);
        if (isset($body['status'])) $member->setStatus($body['status']);
        if (isset($body['tags'])) $member->setTags($body['tags']);
        if (isset($body['preferredGenres'])) $member->setPreferredGenres($body['preferredGenres']);

        $member->setLevel($member->calculateLevel());

        $this->dm->flush();

        return $this->jsonSuccess($this->serializeMember($member));
    }

    #[Route('/api/members/{id}', name: 'api_member_delete', methods: ['DELETE'])]
    public function delete(string $id): JsonResponse
    {
        $member = $this->dm->getRepository(Member::class)->find($id);
        if (!$member) {
            return $this->jsonError('会员不存在', 404, 'NOT_FOUND');
        }
        $this->dm->remove($member);
        $this->dm->flush();
        return $this->jsonSuccess(['deleted' => true, 'id' => $id]);
    }

    #[Route('/api/members/{id}/points/add', name: 'api_member_add_points', methods: ['POST'])]
    public function addPoints(string $id, Request $request): JsonResponse
    {
        $member = $this->dm->getRepository(Member::class)->find($id);
        if (!$member) {
            return $this->jsonError('会员不存在', 404, 'NOT_FOUND');
        }

        $body = $this->getJsonBody($request);
        $points = (int)($body['points'] ?? 0);
        $reason = $body['reason'] ?? '';

        if ($points <= 0) {
            return $this->jsonError('积分必须大于0', 400, 'INVALID_POINTS');
        }

        $member->setPoints($member->getPoints() + $points);
        $member->setLevel($member->calculateLevel());
        $this->dm->flush();

        return $this->jsonSuccess([
            'added' => $points,
            'total' => $member->getPoints(),
            'level' => $member->getLevel(),
            'reason' => $reason,
        ]);
    }

    #[Route('/api/members/stats', name: 'api_member_stats', methods: ['GET'])]
    public function stats(): JsonResponse
    {
        $total = $this->dm->createQueryBuilder(Member::class)->count()->getQuery()->execute();

        $levels = [Member::LEVEL_BRONZE, Member::LEVEL_SILVER, Member::LEVEL_GOLD, Member::LEVEL_PLATINUM];
        $levelStats = [];
        foreach ($levels as $level) {
            $count = $this->dm->createQueryBuilder(Member::class)
                ->field('level')->equals($level)
                ->count()
                ->getQuery()
                ->execute();
            $levelStats[$level] = $count;
        }

        $totalPoints = 0;
        $cursor = $this->dm->createQueryBuilder(Member::class)->getQuery()->execute();
        foreach ($cursor as $m) {
            $totalPoints += $m->getPoints();
        }

        return $this->jsonSuccess([
            'total' => $total,
            'levels' => $levelStats,
            'totalPoints' => $totalPoints,
            'avgPoints' => $total > 0 ? (int)($totalPoints / $total) : 0,
        ]);
    }

    private function serializeMember(Member $m, bool $detail = false): array
    {
        $data = [
            'id' => $m->getId(),
            'name' => $m->getName(),
            'phone' => $m->getPhone(),
            'level' => $m->getLevel(),
            'points' => $m->getPoints(),
            'totalSpent' => $m->getTotalSpent(),
            'watchCount' => $m->getWatchCount(),
            'couponCount' => $m->couponCount,
            'status' => $m->getStatus(),
            'tags' => $m->getTags(),
            'createdAt' => $m->getCreatedAt()?->format(\DateTimeInterface::ATOM),
        ];
        if ($detail) {
            $data['email'] = $m->getEmail();
            $data['birthday'] = $m->getBirthday();
            $data['cinemaId'] = $m->getCinemaId();
            $data['preferredGenres'] = $m->getPreferredGenres();
            $data['lastVisitAt'] = $m->getLastVisitAt()?->format(\DateTimeInterface::ATOM);
        }
        return $data;
    }
}
