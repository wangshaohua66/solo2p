<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Booking;
use App\Models\CreditRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Passport\Passport;
use Carbon\Carbon;

class CreditTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_view_credit_info()
    {
        $user = User::factory()->create(['credit_score' => 100]);
        Passport::actingAs($user);

        $response = $this->getJson('/api/credit/info');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'code',
                'data' => [
                    'user_id',
                    'credit_score',
                    'violation_count',
                    'is_blacklisted',
                    'discount_rate',
                ],
            ])
            ->assertJson(['code' => 0]);
    }

    public function test_user_can_view_credit_records()
    {
        $user = User::factory()->create();
        Passport::actingAs($user);

        CreditRecord::factory()->count(5)->create(['user_id' => $user->id]);

        $response = $this->getJson('/api/credit/records');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'code',
                'data' => ['total', 'list'],
            ])
            ->assertJson(['code' => 0]);
    }

    public function test_initial_credit_score_is_100()
    {
        $user = User::factory()->create();

        $this->assertEquals(100, $user->credit_score);
    }

    public function test_add_credit_score_capped_at_120()
    {
        $user = User::factory()->create(['credit_score' => 115]);

        $user->addCreditScore(10, '测试加分');

        $user->refresh();
        $this->assertEquals(120, $user->credit_score);
    }

    public function test_violation_deducts_credit_score()
    {
        $user = User::factory()->create(['credit_score' => 100, 'violation_count' => 0]);

        $booking = Booking::factory()->create(['user_id' => $user->id]);

        $user->deductCreditScore(10, '超时未签到', $booking);

        $user->refresh();
        $this->assertEquals(90, $user->credit_score);
        $this->assertEquals(1, $user->violation_count);
    }

    public function test_below_60_score_triggers_blacklist()
    {
        $user = User::factory()->create(['credit_score' => 65, 'violation_count' => 0]);

        $user->deductCreditScore(10, '测试扣分');

        $user->refresh();
        $this->assertTrue($user->is_blacklisted);
        $this->assertNotNull($user->blacklist_until);
    }

    public function test_three_violations_trigger_blacklist()
    {
        $user = User::factory()->create(['credit_score' => 100, 'violation_count' => 2]);

        $user->deductCreditScore(10, '第三次违约');

        $user->refresh();
        $this->assertTrue($user->is_blacklisted);
    }

    public function test_blacklist_auto_expires()
    {
        $user = User::factory()->create([
            'is_blacklisted' => true,
            'blacklist_until' => Carbon::now()->subDay(),
        ]);

        $isBlacklisted = $user->isBlacklisted();

        $this->assertFalse($isBlacklisted);
        $user->refresh();
        $this->assertFalse($user->is_blacklisted);
    }

    public function test_high_credit_score_gets_discount()
    {
        $user = User::factory()->create(['credit_score' => 120]);
        $this->assertEquals(0.9, $user->getDiscountRate());

        $user2 = User::factory()->create(['credit_score' => 100]);
        $this->assertEquals(1.0, $user2->getDiscountRate());
    }
}
