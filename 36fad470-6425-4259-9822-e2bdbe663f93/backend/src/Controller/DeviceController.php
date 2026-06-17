<?php

namespace App\Controller;

use App\Document\Device;
use App\Document\User;
use App\Service\DeviceService;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/devices')]
class DeviceController extends AbstractController
{
    private DocumentManager $dm;
    private DeviceService $deviceService;
    private SerializerInterface $serializer;

    public function __construct(
        DocumentManager $dm,
        DeviceService $deviceService,
        SerializerInterface $serializer
    ) {
        $this->dm = $dm;
        $this->deviceService = $deviceService;
        $this->serializer = $serializer;
    }

    #[Route('', name: 'api_devices_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $category = $request->query->get('category');
        $status = $request->query->get('status');

        $qb = $this->dm->getRepository(Device::class)->createQueryBuilder();

        if ($category) {
            $qb->field('category')->equals($category);
        }
        if ($status) {
            $qb->field('status')->equals($status);
        }

        $qb->sort('category', 'asc')->sort('name', 'asc');
        $devices = $qb->getQuery()->toArray();

        return new JsonResponse([
            'devices' => json_decode($this->serializer->serialize(
                $devices,
                'json',
                ['groups' => ['device:list']]
            ), true),
            'total' => count($devices)
        ]);
    }

    #[Route('/stats', name: 'api_devices_stats', methods: ['GET'])]
    public function stats(): JsonResponse
    {
        return new JsonResponse([
            'stats' => $this->deviceService->getDeviceStats()
        ]);
    }

    #[Route('/schedule', name: 'api_devices_schedule', methods: ['GET'])]
    public function schedule(Request $request): JsonResponse
    {
        $deviceId = $request->query->get('deviceId');
        $category = $request->query->get('category');
        $startDate = $request->query->get('startDate');
        $endDate = $request->query->get('endDate');

        $schedule = $this->deviceService->getDeviceUsageSchedule(
            $deviceId,
            $category,
            $startDate ? new \DateTime($startDate) : null,
            $endDate ? new \DateTime($endDate) : null
        );

        return new JsonResponse([
            'schedule' => $schedule
        ]);
    }

    #[Route('/{id}', name: 'api_devices_show', methods: ['GET'])]
    public function show(string $id): JsonResponse
    {
        $device = $this->dm->getRepository(Device::class)->find($id);
        if (!$device) {
            return new JsonResponse(['message' => '设备不存在'], 404);
        }

        return new JsonResponse([
            'device' => json_decode($this->serializer->serialize(
                $device,
                'json',
                ['groups' => ['device:read']]
            ), true)
        ]);
    }

    #[Route('', name: 'api_devices_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user || $user->getRole() !== User::ROLE_VENUE_ADMIN) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $data = json_decode($request->getContent(), true);

        $required = ['name', 'category', 'quantity'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                return new JsonResponse(['message' => sprintf('缺少必要字段: %s', $field)], 400);
            }
        }

        if (!in_array($data['category'], [
            Device::CATEGORY_LIGHTING,
            Device::CATEGORY_SOUND,
            Device::CATEGORY_STAGE
        ])) {
            return new JsonResponse(['message' => '无效的设备类别'], 400);
        }

        $device = $this->deviceService->createDevice($data);

        return new JsonResponse([
            'message' => '设备已添加',
            'device' => json_decode($this->serializer->serialize(
                $device,
                'json',
                ['groups' => ['device:read']]
            ), true)
        ], 201);
    }

    #[Route('/{id}', name: 'api_devices_update', methods: ['PUT'])]
    public function update(string $id, Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user || $user->getRole() !== User::ROLE_VENUE_ADMIN) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $device = $this->dm->getRepository(Device::class)->find($id);
        if (!$device) {
            return new JsonResponse(['message' => '设备不存在'], 404);
        }

        $data = json_decode($request->getContent(), true);
        $device = $this->deviceService->updateDevice($device, $data);

        return new JsonResponse([
            'message' => '设备信息已更新',
            'device' => json_decode($this->serializer->serialize(
                $device,
                'json',
                ['groups' => ['device:read']]
            ), true)
        ]);
    }

    #[Route('/{id}', name: 'api_devices_delete', methods: ['DELETE'])]
    public function delete(string $id): JsonResponse
    {
        $user = $this->getUser();
        if (!$user || $user->getRole() !== User::ROLE_VENUE_ADMIN) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $device = $this->dm->getRepository(Device::class)->find($id);
        if (!$device) {
            return new JsonResponse(['message' => '设备不存在'], 404);
        }

        $this->deviceService->deleteDevice($device);

        return new JsonResponse([
            'message' => '设备已删除'
        ]);
    }

    #[Route('/{id}/maintenance', name: 'api_devices_maintenance_create', methods: ['POST'])]
    public function addMaintenance(string $id, Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user || $user->getRole() !== User::ROLE_VENUE_ADMIN) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $device = $this->dm->getRepository(Device::class)->find($id);
        if (!$device) {
            return new JsonResponse(['message' => '设备不存在'], 404);
        }

        $data = json_decode($request->getContent(), true);

        if (empty($data['startTime']) || empty($data['endTime']) || empty($data['type'])) {
            return new JsonResponse(['message' => '请填写完整的维护信息'], 400);
        }

        $startTime = new \DateTime($data['startTime']);
        $endTime = new \DateTime($data['endTime']);

        if ($endTime <= $startTime) {
            return new JsonResponse(['message' => '结束时间必须晚于开始时间'], 400);
        }

        $conflicts = $this->deviceService->checkMaintenanceConflict($device, $startTime, $endTime);
        if (!empty($conflicts)) {
            return new JsonResponse([
                'message' => '无法安排维护计划',
                'errors' => $conflicts
            ], 400);
        }

        $maintenance = $this->deviceService->addMaintenance($device, [
            'type' => $data['type'],
            'startTime' => $startTime,
            'endTime' => $endTime,
            'notes' => $data['notes'] ?? null
        ]);

        return new JsonResponse([
            'message' => '维护计划已添加',
            'maintenance' => [
                'id' => $maintenance->getId(),
                'type' => $maintenance->getType(),
                'startTime' => $maintenance->getStartTime()->format('Y-m-d H:i:s'),
                'endTime' => $maintenance->getEndTime()->format('Y-m-d H:i:s'),
                'notes' => $maintenance->getNotes()
            ]
        ], 201);
    }

    #[Route('/{id}/check-availability', name: 'api_devices_check_availability', methods: ['GET'])]
    public function checkAvailability(string $id, Request $request): JsonResponse
    {
        $device = $this->dm->getRepository(Device::class)->find($id);
        if (!$device) {
            return new JsonResponse(['message' => '设备不存在'], 404);
        }

        $startTime = new \DateTime($request->query->get('startTime'));
        $endTime = new \DateTime($request->query->get('endTime'));
        $quantity = (int)($request->query->get('quantity') ?? 1);

        $requirement = [
            ['deviceId' => $id, 'deviceName' => $device->getName(), 'quantity' => $quantity]
        ];

        $conflicts = $this->deviceService->checkAvailability(
            $requirement,
            $startTime,
            $endTime
        );

        return new JsonResponse([
            'available' => empty($conflicts),
            'conflicts' => $conflicts,
            'availableQuantity' => $device->getAvailableQuantity()
        ]);
    }
}
