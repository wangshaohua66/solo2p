<?php

require_once dirname(__DIR__).'/vendor/autoload_runtime.php';

return function (array $context) {
    $kernel = new \App\Kernel($context['APP_ENV'], (bool) $context['APP_DEBUG']);
    return $kernel->handle(new \Symfony\Component\HttpFoundation\Request($_SERVER['REQUEST_URI']));
};
