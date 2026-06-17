<?php

namespace App\Controller;

use App\Document\DeviceRequirement;
use App\Document\Performance;
use App\Document\User;
use App\Document\Venue;
use App\Service\ScheduleService;
use App\Service\DeviceService;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/performances')]
class PerformanceController extends AbstractController
{
    private DocumentManager $dm;
    private ScheduleService $scheduleService;
    private DeviceService $deviceService;
    private SerializerInterface $serializer;

    public function __construct(
        DocumentManager $dm,
        ScheduleService $scheduleService,
        DeviceService $deviceService,
        SerializerInterface $serializer
    ) {
        $this->dm = $dm;
        $this->scheduleService = $scheduleService;
        $this->deviceService = $deviceService;
        $this->serializer = $serializer;
    }

    #[Route('', name: 'api_performances_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $status = $request->query->get('status');
        $venueId = $request->query->get('venueId');
        $startDate = $request->query->get('startDate');
        $endDate = $request->query->get('endDate');

        $qb = $this->dm->getRepository(Performance::class)->createQueryBuilder();

        if ($status) {
            $qb->field('status')->equals($status);
        }
        if ($venueId) {
            $qb->field('venue.$id')->equals(new \MongoDB\BSON\ObjectId($venueId));
        }
        if ($startDate) {
            $qb->field('startTime')->gte(new \DateTime($startDate));
        }
        if ($endDate) {
            $qb->field('startTime')->lte(new \DateTime($endDate));
        }

        $user = $this->getUser();
        if ($user && $user->getRole() === User::ROLE_ORGANIZER) {
            $qb->field('organizer.$id')->equals(new \MongoDB\BSON\ObjectId($user->getId()));
        }

        $qb->sort('createdAt', 'desc');
        $performances = $qb->getQuery()->toArray();

        $events = [];
        if ($venueId && $startDate && $endDate) {
            $events = $this->scheduleService->getVenueCalendar(
                $venueId,
                new \DateTime($startDate),
                new \DateTime($endDate)
            );
        }

        return new JsonResponse([
            'performances' => json_decode($this->serializer->serialize(
                $performances,
                'json',
                ['groups' => ['performance:list']]
            ), true),
            'events' => $events,
            'total' => count($performances)
        ]);
    }

    #[Route('/{id}', name: 'api_performances_show', methods: ['GET'])]
    public function show(string $id): JsonResponse
    {
        $performance = $this->dm->getRepository(Performance::class)->find($id);
        if (!$performance) {
            return new JsonResponse(['message' => '演出不存在'], 404);
        }

        return new JsonResponse([
            'performance' => json_decode($this->serializer->serialize(
                $performance,
                'json',
                ['groups' => ['performance:read']]
            ), true)
        ]);
    }

    #[Route('', name: 'api_performances_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $user = $this->getUser();

        if (!$user || !in_array($user->getRole(), [User::ROLE_VENUE_ADMIN, User::ROLE_ORGANIZER])) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $venue = $this->dm->getRepository(Venue::class)->find($data['venueId']);
        if (!$venue) {
            return new JsonResponse(['message' => '场馆不存在'], 400);
        }

        $performance = new Performance();
        $performance->setName($data['name']);
        $performance->setType($data['type']);
        $performance->setOrganizer($user);
        $performance->setOrganizerName($user->getName());
        $performance->setVenue($venue);
        $performance->setVenueName($venue->getName());
        $performance->setExpectedDuration((int)$data['expectedDuration']);
        $performance->setTechnicalRequirements($data['technicalRequirements'] ?? []);
        $performance->setExpectedDates($data['expectedDates'] ?? []);
        $performance->setStatus(Performance::STATUS_PENDING);

        if (!empty($data['devices'])) {
            foreach ($data['devices'] as $deviceData) {
                $deviceReq = new DeviceRequirement();
                $deviceReq->setDeviceId($deviceData['deviceId']);
                $deviceReq->setDeviceName($deviceData['deviceName']);
                $deviceReq->setQuantity((int)$deviceData['quantity']);
                $performance->addDevice($deviceReq);
            }
        }

        $this->dm->persist($performance);
        $this->dm->flush();

        return new JsonResponse([
            'message' => '演出申请已提交',
            'performance' => json_decode($this->serializer->serialize(
                $performance,
                'json',
                ['groups' => ['performance:read']]
            ), true)
        ], 201);
    }

    #[Route('/{id}/approve', name: 'api_performances_approve', methods: ['POST'])]
    public function approve(string $id, Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $user = $this->getUser();

        if (!$user || $user->getRole() !== User::ROLE_VENUE_ADMIN) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $performance = $this->dm->getRepository(Performance::class)->find($id);
        if (!$performance) {
            return new JsonResponse(['message' => '演出不存在'], 404);
        }

        $startTime = new \DateTime($data['startTime']);
        $endTime = new \DateTime($data['endTime']);

        $errors = $this->scheduleService->validateScheduleForApproval(
            $performance->getVenue()->getId(),
            $startTime,
            $endTime,
            $id
        );

        if (!empty($errors)) {
            return new JsonResponse([
                'message' => '档期校验失败',
                'errors' => $errors
            ], 400);
        }

        $deviceConflicts = [];
        if ($performance->getDevices()->count() > 0) {
            $deviceConflicts = $this->deviceService->checkAvailability(
                $performance->getDevices()->toArray(),
                $startTime,
                $endTime,
                $id
            );
        }

        if (!empty($deviceConflicts)) {
            return new JsonResponse([
                'message' => '设备调度冲突',
                'errors' => array_column($deviceConflicts, 'message')
            ], 400);
        }

        $performance->setStartTime($startTime);
        $performance->setEndTime($endTime);
        $performance->setStatus(Performance::STATUS_APPROVED);
        $performance->setApprovedAt(new \DateTime());

        $this->dm->flush();

        return new JsonResponse([
            'message' => '演出审批通过',
            'performance' => json_decode($this->serializer->serialize(
                $performance,
                'json',
                ['groups' => ['performance:read']]
            ), true)
        ]);
    }

    #[Route('/{id}/reject', name: 'api_performances_reject', methods: ['POST'])]
    public function reject(string $id, Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $user = $this->getUser();

        if (!$user || $user->getRole() !== User::ROLE_VENUE_ADMIN) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $performance = $this->dm->getRepository(Performance::class)->find($id);
        if (!$performance) {
            return new JsonResponse(['message' => '演出不存在'], 404);
        }

        if (empty($data['reason'])) {
            return new JsonResponse(['message' => '请填写驳回原因'], 400);
        }

        $performance->setStatus(Performance::STATUS_REJECTED);
        $performance->setRejectReason($data['reason']);

        $this->dm->flush();

        return new JsonResponse([
            'message' => '演出申请已驳回',
            'performance' => json_decode($this->serializer->serialize(
                $performance,
                'json',
                ['groups' => ['performance:read']]
            ), true)
        ]);
    }

    #[Route('/{id}/negotiate', name: 'api_performances_negotiate', methods: ['POST'])]
    public function negotiate(string $id, Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $user = $this->getUser();

        if (!$user || $user->getRole() !== User::ROLE_VENUE_ADMIN) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $performance = $this->dm->getRepository(Performance::class)->find($id);
        if (!$performance) {
            return new JsonResponse(['message' => '演出不存在'], 404);
        }

        if (empty($data['suggestedDates'])) {
            return new JsonResponse(['message' => '请选择建议日期'], 400);
        }

        $performance->setStatus(Performance::STATUS_NEGOTIATING);
        $performance->setExpectedDates($data['suggestedDates']);

        $this->dm->flush();

        return new JsonResponse([
            'message' => '已发送协商通知',
            'performance' => json_decode($this->serializer->serialize(
                $performance,
                'json',
                ['groups' => ['performance:read']]
            ), true)
        ]);
    }

    #[Route('/{id}', name: 'api_performances_update', methods: ['PUT'])]
    public function update(string $id, Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $user = $this->getUser();

        $performance = $this->dm->getRepository(Performance::class)->find($id);
        if (!$performance) {
            return new JsonResponse(['message' => '演出不存在'], 404);
        }

        if ($user->getRole() === User::ROLE_ORGANIZER && $performance->getOrganizer()->getId() !== $user->getId()) {
            return new JsonResponse(['message' => '只能修改自己的演出申请'], 403);
        }

        if (isset($data['name'])) {
            $performance->setName($data['name']);
        }
        if (isset($data['type'])) {
            $performance->setType($data['type']);
        }
        if (isset($data['expectedDuration'])) {
            $performance->setExpectedDuration((int)$data['expectedDuration']);
        }
        if (isset($data['technicalRequirements'])) {
            $performance->setTechnicalRequirements($data['technicalRequirements']);
        }
        if (isset($data['expectedDates'])) {
            $performance->setExpectedDates($data['expectedDates']);
        }
        if ($performance->getStatus() !== Performance::STATUS_APPROVED) {
            $performance->setStatus(Performance::STATUS_PENDING);
        }

        $this->dm->flush();

        return new JsonResponse([
            'message' => '演出信息已更新',
            'performance' => json_decode($this->serializer->serialize(
                $performance,
                'json',
                ['groups' => ['performance:read']]
            ), true)
        ]);
    }

    #[Route('/{id}/check-conflicts', name: 'api_performances_check_conflicts', methods: ['GET'])]
    public function checkConflicts(string $id, Request $request): JsonResponse
    {
        $performance = $this->dm->getRepository(Performance::class)->find($id);
        if (!$performance) {
            return new JsonResponse(['message' => '演出不存在'], 404);
        }

        $startTime = new \DateTime($request->query->get('startTime'));
        $endTime = new \DateTime($request->query->get('endTime'));

        $scheduleConflicts = $this->scheduleService->checkConflict(
            $performance->getVenue()->getId(),
            $startTime,
            $endTime,
            $id
        );

        $deviceConflicts = [];
        if ($performance->getDevices()->count() > 0) {
            $deviceConflicts = $this->deviceService->checkAvailability(
                $performance->getDevices()->toArray(),
                $startTime,
                $endTime,
                $id
            );
        }

        return new JsonResponse([
            'scheduleConflicts' => $scheduleConflicts,
            'deviceConflicts' => $deviceConflicts,
            'hasConflict' => !empty($scheduleConflicts) || !empty($deviceConflicts)
        ]);
    }
}
