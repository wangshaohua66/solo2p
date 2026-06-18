<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;

class Controller extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    protected function success($data = null, string $message = 'success', int $code = 0)
    {
        return response()->json([
            'code' => $code,
            'message' => $message,
            'data' => $data,
        ]);
    }

    protected function error(string $message = 'error', int $code = 1, $data = null, int $statusCode = 400)
    {
        return response()->json([
            'code' => $code,
            'message' => $message,
            'data' => $data,
        ], $statusCode);
    }
}
