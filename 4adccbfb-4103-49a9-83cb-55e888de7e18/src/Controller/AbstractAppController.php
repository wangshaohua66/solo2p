<?php

namespace App\Controller;

use App\Entity\Exhibition;
use App\Service\CacheService;
use App\Service\ContextService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;

abstract class AbstractAppController extends AbstractController
{
    public function __construct(
        protected readonly ContextService $context,
        protected readonly CacheService $cache,
        protected readonly EntityManagerInterface $em
    ) {
    }

    protected function jsonOk(mixed $data = [], string $msg = '操作成功'): JsonResponse
    {
        return new JsonResponse(['ok' => true, 'msg' => $msg, 'data' => $data]);
    }

    protected function jsonError(string $msg, int $code = 400): JsonResponse
    {
        return new JsonResponse(['ok' => false, 'error' => $msg], $code);
    }

    protected function currentExhibition(): ?Exhibition
    {
        return $this->context->getCurrentExhibition();
    }

    /** 模板公共变量 */
    protected function viewVars(array $extra = []): array
    {
        return array_merge([
            'redis_ok' => $this->cache->isAvailable(),
        ], $extra);
    }
}
