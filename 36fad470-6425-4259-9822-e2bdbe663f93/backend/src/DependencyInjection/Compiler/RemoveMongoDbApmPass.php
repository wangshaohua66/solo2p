<?php

namespace App\DependencyInjection\Compiler;

use Symfony\Component\DependencyInjection\Compiler\CompilerPassInterface;
use Symfony\Component\DependencyInjection\ContainerBuilder;

class RemoveMongoDbApmPass implements CompilerPassInterface
{
    public function process(ContainerBuilder $container)
    {
        $services = [
            'doctrine_mongodb.odm.stopwatch_command_logger',
            'doctrine_mongodb.odm.command_logger_registry',
        ];

        foreach ($services as $serviceId) {
            if ($container->hasDefinition($serviceId)) {
                $container->removeDefinition($serviceId);
            }
        }
    }
}
