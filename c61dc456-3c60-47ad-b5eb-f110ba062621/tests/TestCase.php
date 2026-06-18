<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Passport\Client;
use Laravel\Passport\PersonalAccessClient;

abstract class TestCase extends BaseTestCase
{
    use CreatesApplication;

    protected function setUp(): void
    {
        parent::setUp();

        $this->artisan('migrate', ['--force' => true]);

        $client = Client::create([
            'name' => 'Test Personal Access Client',
            'secret' => bcrypt('test-secret'),
            'redirect' => '',
            'personal_access_client' => true,
            'password_client' => false,
            'revoked' => false,
        ]);

        PersonalAccessClient::create([
            'client_id' => $client->id,
        ]);

        Client::create([
            'name' => 'Test Password Grant Client',
            'secret' => bcrypt('test-secret'),
            'redirect' => '',
            'personal_access_client' => false,
            'password_client' => true,
            'revoked' => false,
        ]);
    }
}
