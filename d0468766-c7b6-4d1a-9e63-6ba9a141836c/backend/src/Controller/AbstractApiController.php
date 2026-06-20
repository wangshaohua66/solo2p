<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

abstract class AbstractApiController extends AbstractController
{
    protected function jsonSuccess(mixed $data = null, int $status = Response::HTTP_OK): JsonResponse
    {
        return $this->json([
            'success' => true,
            'data' => $data,
            'timestamp' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
        ], $status);
    }

    protected function jsonError(
        string $message,
        int $status = Response::HTTP_BAD_REQUEST,
        ?string $code = null,
        ?array $details = null
    ): JsonResponse {
        return $this->json([
            'success' => false,
            'error' => [
                'code' => $code ?? (string)$status,
                'message' => $message,
                'details' => $details,
            ],
            'timestamp' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
        ], $status);
    }

    protected function getJsonBody(Request $request): array
    {
        $content = $request->getContent();
        if (empty($content)) {
            return [];
        }
        $data = json_decode($content, true);
        return is_array($data) ? $data : [];
    }

    protected function getCurrentUserRole(): string
    {
        $user = $this->getUser();
        if ($user && method_exists($user, 'getRole')) {
            return $user->getRole();
        }
        return \App\Document\User::ROLE_MANAGEMENT;
    }

    protected function canAccess(string $route): bool
    {
        $user = $this->getUser();
        if ($user && method_exists($user, 'canAccess')) {
            return $user->canAccess($route);
        }
        return true;
    }
}
