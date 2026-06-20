<?php

namespace App\EventSubscriber;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Security\Csrf\CsrfToken;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;

/**
 * 对所有写操作（POST/PUT/PATCH/DELETE）强制校验 X-CSRF-Token 头，
 * 防止跨站请求伪造。GET 请求与 Symfony 内部路由（/_）豁免。
 */
class CSRFSubscriber implements EventSubscriberInterface
{
    public function __construct(private readonly CsrfTokenManagerInterface $csrf)
    {
    }

    public function onKernelRequest(RequestEvent $event): void
    {
        $request = $event->getRequest();
        if (!$event->isMainRequest()) {
            return;
        }
        if (str_starts_with($request->getPathInfo(), '/_')) {
            return;
        }
        $method = $request->getMethod();
        if (!in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return;
        }
        $token = $request->headers->get('X-CSRF-Token');
        if (!$token || !$this->csrf->isTokenValid(new CsrfToken('api', $token))) {
            $event->setResponse(new JsonResponse(['ok' => false, 'error' => 'CSRF token 无效，请刷新页面后重试。'], 419));
        }
    }

    public static function getSubscribedEvents(): array
    {
        return [KernelEvents::REQUEST => ['onKernelRequest', 0]];
    }
}
