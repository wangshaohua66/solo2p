<?php

namespace App\Controller;

use App\Repository\CustomerRepository;
use App\Repository\WorkOrderRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/customers')]
class CustomerController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly CustomerRepository $customerRepo,
        private readonly WorkOrderRepository $orderRepo,
        private readonly SerializerInterface $serializer,
    ) {}

    #[Route('/list', methods: ['POST'])]
    public function list(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $filters = $body['filter'] ?? [];
        $page = (int)($body['page'] ?? 1);
        $pageSize = (int)($body['pageSize'] ?? 50);

        $qb = $this->customerRepo->createQueryBuilder('c');

        if (!empty($filters['keyword'])) {
            $kw = '%' . $filters['keyword'] . '%';
            $qb->andWhere(
                $qb->expr()->orX(
                    'c.name LIKE :kw',
                    'c.phone LIKE :kw',
                    'c.email LIKE :kw',
                    'c.notes LIKE :kw'
                )
            )->setParameter('kw', $kw);
        }

        if (!empty($filters['vipOnly'])) {
            $qb->andWhere('c.totalOrders >= :t')->setParameter('t', 3);
        }

        $qb->orderBy('c.updatedAt', 'DESC');

        $total = (clone $qb)->select('COUNT(c.id)')->getQuery()->getSingleScalarResult();

        $offset = ($page - 1) * $pageSize;
        $data = $qb->setFirstResult($offset)
            ->setMaxResults($pageSize)
            ->getQuery()
            ->getResult();

        $json = $this->serializer->serialize([
            'data' => $data,
            'total' => (int)$total,
            'page' => $page,
            'pageSize' => $pageSize,
        ], 'json', [
            'groups' => ['customer:list'],
            'circular_reference_handler' => fn($o) => $o->getId(),
        ]);

        return new JsonResponse($json, 200, [], true);
    }

    #[Route('/{id}', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function get(int $id): JsonResponse
    {
        $customer = $this->customerRepo->find($id);
        if (!$customer) {
            throw new \Symfony\Component\HttpKernel\Exception\NotFoundHttpException('客户不存在');
        }
        $json = $this->serializer->serialize($customer, 'json', [
            'groups' => ['customer:read'],
            'circular_reference_handler' => fn($o) => $o->getId(),
        ]);
        return new JsonResponse($json, 200, [], true);
    }

    #[Route('/{id}/orders', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function customerOrders(int $id): JsonResponse
    {
        $customer = $this->customerRepo->find($id);
        if (!$customer) {
            throw new \Symfony\Component\HttpKernel\Exception\NotFoundHttpException('客户不存在');
        }

        $orders = $this->orderRepo->createQueryBuilder('wo')
            ->leftJoin('wo.movement', 'm')
            ->addSelect('m')
            ->where('wo.customer = :cid')
            ->setParameter('cid', $id)
            ->orderBy('wo.createdAt', 'DESC')
            ->setMaxResults(100)
            ->getQuery()
            ->getResult();

        $json = $this->serializer->serialize([
            'customer' => [
                'id' => $customer->getId(),
                'name' => $customer->getName(),
                'phone' => $customer->getPhone(),
                'totalOrders' => $customer->getTotalOrders(),
            ],
            'orders' => $orders,
        ], 'json', [
            'groups' => ['workorder:list', 'customer:read'],
            'circular_reference_handler' => fn($o) => $o->getId(),
        ]);
        return new JsonResponse($json, 200, [], true);
    }

    #[Route('', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?: [];

        if (empty($data['name']) && empty($data['phone'])) {
            throw new \Symfony\Component\HttpKernel\Exception\BadRequestHttpException('姓名和手机号至少填一个');
        }

        $customer = new \App\Entity\Customer();
        $fields = ['name', 'phone', 'email', 'address', 'notes', 'birthday', 'gender'];
        foreach ($fields as $f) {
            if (isset($data[$f])) {
                $m = 'set' . ucfirst($f);
                $customer->$m($data[$f]);
            }
        }

        if (!empty($data['tags'])) {
            $customer->setTags((array)$data['tags']);
        }

        $this->em->persist($customer);
        $this->em->flush();

        return new JsonResponse(
            json_decode($this->serializer->serialize($customer, 'json', [
                'groups' => ['customer:read'],
                'circular_reference_handler' => fn($o) => $o->getId(),
            ]), true),
            201
        );
    }

    #[Route('/{id}', methods: ['PUT'], requirements: ['id' => '\d+'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $customer = $this->customerRepo->find($id);
        if (!$customer) {
            throw new \Symfony\Component\HttpKernel\Exception\NotFoundHttpException('客户不存在');
        }

        $data = json_decode($request->getContent(), true) ?: [];
        $fields = ['name', 'phone', 'email', 'address', 'notes', 'birthday', 'gender', 'totalOrders'];
        foreach ($fields as $f) {
            if (isset($data[$f])) {
                $m = 'set' . ucfirst($f);
                if ($f === 'totalOrders') {
                    continue;
                }
                $customer->$m($data[$f]);
            }
        }

        if (isset($data['tags'])) {
            $customer->setTags((array)$data['tags']);
        }

        $this->em->flush();
        return new JsonResponse(
            json_decode($this->serializer->serialize($customer, 'json', [
                'groups' => ['customer:read'],
                'circular_reference_handler' => fn($o) => $o->getId(),
            ]), true)
        );
    }

    #[Route('/{id}', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id): JsonResponse
    {
        $customer = $this->customerRepo->find($id);
        if (!$customer) {
            throw new \Symfony\Component\HttpKernel\Exception\NotFoundHttpException('客户不存在');
        }

        $orderCount = $this->orderRepo->createQueryBuilder('wo')
            ->select('COUNT(wo.id)')
            ->where('wo.customer = :cid')
            ->setParameter('cid', $id)
            ->getQuery()
            ->getSingleScalarResult();

        if ($orderCount > 0) {
            throw new \Symfony\Component\HttpKernel\Exception\BadRequestHttpException(
                sprintf('客户关联了 %d 个工单，不能删除', $orderCount)
            );
        }

        $this->em->remove($customer);
        $this->em->flush();
        return $this->json(['success' => true]);
    }

    #[Route('/search', methods: ['POST'])]
    public function search(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $query = trim($body['query'] ?? '');
        $limit = (int)($body['limit'] ?? 20);

        if (empty($query)) {
            return $this->json(['results' => []]);
        }

        $qb = $this->customerRepo->createQueryBuilder('c');
        $kw = '%' . $query . '%';
        $qb->where('c.name LIKE :kw')
            ->orWhere('c.phone LIKE :kw')
            ->orWhere('c.email LIKE :kw')
            ->setParameter('kw', $kw)
            ->orderBy('c.totalOrders', 'DESC')
            ->setMaxResults($limit);

        $list = $qb->getQuery()->getResult();
        $json = $this->serializer->serialize($list, 'json', [
            'groups' => ['customer:list'],
            'circular_reference_handler' => fn($o) => $o->getId(),
        ]);
        return new JsonResponse(json_decode($json, true));
    }
}
