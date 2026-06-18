<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiResponseMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if ($response->isSuccessful() && is_array($response->original)) {
            $data = $response->original;

            if (!isset($data['code']) || !isset($data['message']) || !array_key_exists('data', $data)) {
                $response->setContent(json_encode([
                    'code' => 0,
                    'message' => 'success',
                    'data' => $response->original,
                ]));
                $response->headers->set('Content-Type', 'application/json');
            }
        }

        return $response;
    }
}
