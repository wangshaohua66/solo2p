<?php

namespace App\Controller;

use App\Document\DcpItem;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class DcpController extends AbstractApiController
{
    public function __construct(private DocumentManager $dm)
    {
    }

    #[Route('/api/dcp', name: 'api_dcp_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $status = $request->query->get('status');
        $cinemaId = $request->query->get('cinemaId');
        $movieId = $request->query->get('movieId');

        $qb = $this->dm->createQueryBuilder(DcpItem::class);

        if ($status) {
            $qb->field('status')->equals($status);
        }
        if ($cinemaId) {
            $qb->field('cinemaId')->equals($cinemaId);
        }
        if ($movieId) {
            $qb->field('movieId')->equals($movieId);
        }

        $qb->sort('createdAt', 'desc');
        $cursor = $qb->getQuery()->execute();

        $items = [];
        foreach ($cursor as $d) {
            $items[] = $this->serializeDcp($d);
        }

        return $this->jsonSuccess(['items' => $items, 'total' => count($items)]);
    }

    #[Route('/api/dcp/{id}', name: 'api_dcp_detail', methods: ['GET'])]
    public function detail(string $id): JsonResponse
    {
        $dcp = $this->dm->getRepository(DcpItem::class)->find($id);
        if (!$dcp) {
            return $this->jsonError('DCP记录不存在', 404, 'NOT_FOUND');
        }
        return $this->jsonSuccess($this->serializeDcp($dcp, true));
    }

    #[Route('/api/dcp', name: 'api_dcp_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $body = $this->getJsonBody($request);

        $required = ['movieId', 'movieName', 'cinemaId', 'cinemaName', 'sourceCinemaId', 'sourceCinemaName'];
        foreach ($required as $k) {
            if (!isset($body[$k])) {
                return $this->jsonError('缺少必要字段: ' . $k, 400, 'MISSING_FIELD');
            }
        }

        $dcp = new DcpItem();
        $dcp->setId($body['id'] ?? uniqid('dcp_', true));
        $dcp->setMovieId($body['movieId']);
        $dcp->setMovieName($body['movieName']);
        $dcp->setCinemaId($body['cinemaId']);
        $dcp->setCinemaName($body['cinemaName']);
        $dcp->setSourceCinemaId($body['sourceCinemaId']);
        $dcp->setSourceCinemaName($body['sourceCinemaName']);
        $dcp->setCarrier($body['carrier'] ?? '自有物流');
        $dcp->setTrackingNo($body['trackingNo'] ?? 'DCP' . date('YmdHis') . mt_rand(100, 999));
        $dcp->setStatus($body['status'] ?? DcpItem::STATUS_DELIVERING);
        $dcp->setProgress((int)($body['progress'] ?? 0));
        if (!empty($body['estimatedArrival'])) {
            $dcp->setEstimatedArrival(new \DateTimeImmutable($body['estimatedArrival']));
        }
        $dcp->addLog('created', $body['operator'] ?? '系统', '创建DCP调度记录');

        $this->dm->persist($dcp);
        $this->dm->flush();

        return $this->jsonSuccess($this->serializeDcp($dcp), 201);
    }

    #[Route('/api/dcp/{id}', name: 'api_dcp_update', methods: ['PUT'])]
    public function update(string $id, Request $request): JsonResponse
    {
        $dcp = $this->dm->getRepository(DcpItem::class)->find($id);
        if (!$dcp) {
            return $this->jsonError('DCP记录不存在', 404, 'NOT_FOUND');
        }

        $body = $this->getJsonBody($request);

        if (isset($body['carrier'])) $dcp->setCarrier($body['carrier']);
        if (isset($body['trackingNo'])) $dcp->setTrackingNo($body['trackingNo']);
        if (isset($body['status'])) {
            $dcp->setStatus($body['status']);
            if ($body['status'] === DcpItem::STATUS_RECEIVED) {
                $dcp->setProgress(100);
                $dcp->setReceivedAt(new \DateTimeImmutable());
            }
        }
        if (isset($body['progress'])) $dcp->setProgress((int)$body['progress']);
        if (!empty($body['estimatedArrival'])) {
            $dcp->setEstimatedArrival(new \DateTimeImmutable($body['estimatedArrival']));
        }
        if (isset($body['logAction'])) {
            $dcp->addLog($body['logAction'], $body['logOperator'] ?? '系统', $body['logNote'] ?? null);
        }

        $this->dm->flush();

        return $this->jsonSuccess($this->serializeDcp($dcp));
    }

    #[Route('/api/dcp/{id}', name: 'api_dcp_delete', methods: ['DELETE'])]
    public function delete(string $id): JsonResponse
    {
        $dcp = $this->dm->getRepository(DcpItem::class)->find($id);
        if (!$dcp) {
            return $this->jsonError('DCP记录不存在', 404, 'NOT_FOUND');
        }
        $this->dm->remove($dcp);
        $this->dm->flush();
        return $this->jsonSuccess(['deleted' => true, 'id' => $id]);
    }

    #[Route('/api/dcp/transfer', name: 'api_dcp_transfer', methods: ['POST'])]
    public function transfer(Request $request): JsonResponse
    {
        $body = $this->getJsonBody($request);
        return $this->create($request);
    }

    #[Route('/api/dcp/stats', name: 'api_dcp_stats', methods: ['GET'])]
    public function stats(): JsonResponse
    {
        $statuses = [DcpItem::STATUS_DELIVERING, DcpItem::STATUS_RECEIVED, DcpItem::STATUS_VERIFIED, DcpItem::STATUS_PLAYING, DcpItem::STATUS_RECALLED];
        $stats = [];
        foreach ($statuses as $s) {
            $stats[$s] = $this->dm->createQueryBuilder(DcpItem::class)
                ->field('status')->equals($s)
                ->count()
                ->getQuery()
                ->execute();
        }
        return $this->jsonSuccess(['statusCounts' => $stats, 'total' => array_sum($stats)]);
    }

    private function serializeDcp(DcpItem $d, bool $detail = false): array
    {
        $data = [
            'id' => $d->getId(),
            'movieId' => $d->getMovieId(),
            'movieName' => $d->getMovieName(),
            'cinemaId' => $d->getCinemaId(),
            'cinemaName' => $d->getCinemaName(),
            'sourceCinemaId' => $d->getSourceCinemaId(),
            'sourceCinemaName' => $d->getSourceCinemaName(),
            'carrier' => $d->getCarrier(),
            'trackingNo' => $d->getTrackingNo(),
            'status' => $d->getStatus(),
            'progress' => $d->getProgress(),
            'estimatedArrival' => $d->getEstimatedArrival()?->format(\DateTimeInterface::ATOM),
            'receivedAt' => $d->getReceivedAt()?->format(\DateTimeInterface::ATOM),
            'createdAt' => $d->getCreatedAt()?->format(\DateTimeInterface::ATOM),
        ];
        if ($detail) {
            $data['logs'] = $d->getLogs();
        }
        return $data;
    }
}
