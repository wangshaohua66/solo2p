<?php

namespace App\Service;

use App\Document\Device;
use App\Document\DeviceMaintenance;
use App\Document\DeviceRequirement;
use App\Document\Performance;
use Doctrine\ODM\MongoDB\DocumentManager;
use Doctrine\ODM\MongoDB\Repository\DocumentRepository;

class DeviceService
{
    private DocumentManager $dm;
    private DocumentRepository $deviceRepo;

    public function __construct(DocumentManager $dm)
    {
        $this->dm = $dm;
        $this->deviceRepo = $dm->getRepository(Device::class);
    }

    public function checkAvailability(
        array $requirements,
        \DateTimeInterface $startTime,
        \DateTimeInterface $endTime,
        ?string $excludePerformanceId = null
    ): array {
        $conflicts = [];

        foreach ($requirements as $req) {
            $deviceId = $req instanceof DeviceRequirement ? $req->getDeviceId() : $req['deviceId'];
            $quantity = $req instanceof DeviceRequirement ? $req->getQuantity() : $req['quantity'];

            $device = $this->deviceRepo->find($deviceId);
            if (!$device) {
                $conflicts[] = [
                    'deviceId' => $deviceId,
                    'deviceName' => $req['deviceName'] ?? '未知设备',
                    'message' => '设备不存在'
                ];
                continue;
            }

            if ($device->getStatus() === Device::STATUS_DAMAGED) {
                $conflicts[] = [
                    'deviceId' => $deviceId,
                    'deviceName' => $device->getName(),
                    'message' => '设备已损坏，不可使用'
                ];
                continue;
            }

            if ($device->getStatus() === Device::STATUS_MAINTENANCE) {
                foreach ($device->getMaintenanceSchedule() as $maintenance) {
                    if (
                        $startTime < $maintenance->getEndTime() &&
                        $endTime > $maintenance->getStartTime()
                    ) {
                        $conflicts[] = [
                            'deviceId' => $deviceId,
                            'deviceName' => $device->getName(),
                            'message' => sprintf(
                                '设备处于维护期（%s ~ %s）',
                                $maintenance->getStartTime()->format('Y-m-d H:i'),
                                $maintenance->getEndTime()->format('Y-m-d H:i')
                            )
                        ];
                        break 2;
                    }
                }
            }

            $allocatedQty = $this->getAllocatedQuantity($deviceId, $startTime, $endTime, $excludePerformanceId);
            $availableQty = $device->getQuantity() - $allocatedQty;

            if ($quantity > $availableQty) {
                $conflicts[] = [
                    'deviceId' => $deviceId,
                    'deviceName' => $device->getName(),
                    'requested' => $quantity,
                    'available' => $availableQty,
                    'message' => sprintf(
                        '设备数量不足（请求%d台，可用%d台）',
                        $quantity,
                        $availableQty
                    )
                ];
            }
        }

        return $conflicts;
    }

    public function getAllocatedQuantity(
        string $deviceId,
        \DateTimeInterface $startTime,
        \DateTimeInterface $endTime,
        ?string $excludePerformanceId = null
    ): int {
        $qb = $this->dm->createQueryBuilder(Performance::class)
            ->field('status')->in([Performance::STATUS_APPROVED, Performance::STATUS_PENDING])
            ->field('startTime')->exists(true)
            ->field('endTime')->exists(true)
            ->field('startTime')->lt($endTime)
            ->field('endTime')->gt($startTime);

        if ($excludePerformanceId) {
            $qb->field('id')->notEqual($excludePerformanceId);
        }

        $performances = $qb->getQuery()->execute();
        $allocated = 0;

        foreach ($performances as $perf) {
            foreach ($perf->getDevices() as $deviceReq) {
                if ($deviceReq->getDeviceId() === $deviceId) {
                    $allocated += $deviceReq->getQuantity();
                }
            }
        }

        return $allocated;
    }

    public function getDeviceUsageSchedule(
        ?string $deviceId = null,
        ?string $category = null,
        ?\DateTimeInterface $startDate = null,
        ?\DateTimeInterface $endDate = null
    ): array {
        $qb = $this->deviceRepo->createQueryBuilder();

        if ($deviceId) {
            $qb->field('id')->equals($deviceId);
        }
        if ($category) {
            $qb->field('category')->equals($category);
        }

        $devices = $qb->getQuery()->execute();

        $schedule = [];
        $perfQb = $this->dm->createQueryBuilder(Performance::class)
            ->field('status')->in([Performance::STATUS_APPROVED, Performance::STATUS_PENDING])
            ->field('startTime')->exists(true)
            ->field('endTime')->exists(true);

        if ($startDate) {
            $perfQb->field('endTime')->gte($startDate);
        }
        if ($endDate) {
            $perfQb->field('startTime')->lte($endDate);
        }

        $performances = $perfQb->getQuery()->toArray();

        foreach ($devices as $device) {
            $deviceSchedule = [
                'deviceId' => $device->getId(),
                'deviceName' => $device->getName(),
                'category' => $device->getCategory(),
                'totalQuantity' => $device->getQuantity(),
                'availableQuantity' => $device->getAvailableQuantity(),
                'status' => $device->getStatus(),
                'usages' => [],
                'maintenance' => []
            ];

            foreach ($performances as $perf) {
                foreach ($perf->getDevices() as $req) {
                    if ($req->getDeviceId() === $device->getId()) {
                        $deviceSchedule['usages'][] = [
                            'performanceId' => $perf->getId(),
                            'performanceName' => $perf->getName(),
                            'quantity' => $req->getQuantity(),
                            'startTime' => $perf->getStartTime(),
                            'endTime' => $perf->getEndTime(),
                            'status' => $perf->getStatus()
                        ];
                    }
                }
            }

            foreach ($device->getMaintenanceSchedule() as $maintenance) {
                $deviceSchedule['maintenance'][] = [
                    'id' => $maintenance->getId(),
                    'type' => $maintenance->getType(),
                    'startTime' => $maintenance->getStartTime(),
                    'endTime' => $maintenance->getEndTime(),
                    'notes' => $maintenance->getNotes()
                ];
            }

            $schedule[] = $deviceSchedule;
        }

        return $schedule;
    }

    public function addMaintenance(Device $device, array $data): DeviceMaintenance
    {
        $maintenance = new DeviceMaintenance();
        $maintenance->setDeviceId($device->getId());
        $maintenance->setType($data['type']);
        $maintenance->setStartTime($data['startTime']);
        $maintenance->setEndTime($data['endTime']);
        $maintenance->setNotes($data['notes'] ?? null);

        $device->addMaintenanceSchedule($maintenance);
        $device->setStatus(Device::STATUS_MAINTENANCE);

        $this->dm->flush();

        return $maintenance;
    }

    public function checkMaintenanceConflict(
        Device $device,
        \DateTimeInterface $startTime,
        \DateTimeInterface $endTime
    ): array {
        $conflicts = [];

        foreach ($device->getMaintenanceSchedule() as $existing) {
            if (
                $startTime < $existing->getEndTime() &&
                $endTime > $existing->getStartTime()
            ) {
                $conflicts[] = sprintf(
                    '与已有维护计划冲突（%s ~ %s）',
                    $existing->getStartTime()->format('Y-m-d H:i'),
                    $existing->getEndTime()->format('Y-m-d H:i')
                );
            }
        }

        $allocatedQty = $this->getAllocatedQuantity($device->getId(), $startTime, $endTime);
        if ($allocatedQty > 0) {
            $conflicts[] = sprintf(
                '该时段已有演出使用此设备（%d台），维护将影响演出',
                $allocatedQty
            );
        }

        return $conflicts;
    }

    public function createDevice(array $data): Device
    {
        $device = new Device();
        $device->setName($data['name']);
        $device->setCategory($data['category']);
        $device->setSpecification($data['specification'] ?? null);
        $device->setQuantity($data['quantity']);
        $device->setAvailableQuantity($data['quantity']);
        $device->setStatus(Device::STATUS_AVAILABLE);

        $this->dm->persist($device);
        $this->dm->flush();

        return $device;
    }

    public function updateDevice(Device $device, array $data): Device
    {
        if (isset($data['name'])) {
            $device->setName($data['name']);
        }
        if (isset($data['category'])) {
            $device->setCategory($data['category']);
        }
        if (isset($data['specification'])) {
            $device->setSpecification($data['specification']);
        }
        if (isset($data['quantity'])) {
            $diff = $data['quantity'] - $device->getQuantity();
            $device->setQuantity($data['quantity']);
            $device->setAvailableQuantity(max(0, $device->getAvailableQuantity() + $diff));
        }
        if (isset($data['status'])) {
            $device->setStatus($data['status']);
        }

        $this->dm->flush();

        return $device;
    }

    public function deleteDevice(Device $device): void
    {
        $this->dm->remove($device);
        $this->dm->flush();
    }

    public function getDeviceStats(): array
    {
        $total = $this->deviceRepo->createQueryBuilder()->count()->getQuery()->execute();

        $byCategory = [];
        foreach ([Device::CATEGORY_LIGHTING, Device::CATEGORY_SOUND, Device::CATEGORY_STAGE] as $cat) {
            $count = $this->deviceRepo->createQueryBuilder()
                ->field('category')->equals($cat)
                ->count()
                ->getQuery()
                ->execute();
            $byCategory[$cat] = $count;
        }

        $inMaintenance = $this->deviceRepo->createQueryBuilder()
            ->field('status')->equals(Device::STATUS_MAINTENANCE)
            ->count()
            ->getQuery()
            ->execute();

        $inUse = $this->deviceRepo->createQueryBuilder()
            ->field('status')->equals(Device::STATUS_IN_USE)
            ->count()
            ->getQuery()
            ->execute();

        return [
            'total' => $total,
            'byCategory' => $byCategory,
            'inMaintenance' => $inMaintenance,
            'inUse' => $inUse
        ];
    }
}
