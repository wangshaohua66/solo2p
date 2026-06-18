<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Venue;
use App\Models\Court;
use App\Models\TimeSlot;
use App\Models\Booking;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Passport\Passport;
use Carbon\Carbon;

class BookingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
    }

    protected function createVenueWithSlots()
    {
        $venue = Venue::factory()->create([
            'open_time' => '09:00',
            'close_time' => '12:00',
            'slot_duration' => 60,
            'base_price' => 50,
            'peak_price' => 75,
        ]);

        Court::factory()->count(5)->create(['venue_id' => $venue->id]);

        $tomorrow = Carbon::tomorrow()->format('Y-m-d');

        TimeSlot::create([
            'venue_id' => $venue->id,
            'date' => $tomorrow,
            'start_time' => '09:00',
            'end_time' => '10:00',
            'total_courts' => 5,
            'booked_courts' => 0,
            'price' => 50,
            'is_peak' => false,
            'is_active' => true,
        ]);

        return $venue;
    }

    public function test_user_can_create_booking()
    {
        $user = User::factory()->create(['is_verified' => true]);
        Passport::actingAs($user);

        $venue = $this->createVenueWithSlots();
        $slot = $venue->timeSlots()->first();

        $response = $this->postJson('/api/bookings', [
            'venue_id' => $venue->id,
            'time_slot_id' => $slot->id,
        ]);

        $response->assertStatus(200)
            ->assertJson(['code' => 0]);

        $this->assertDatabaseHas('bookings', [
            'user_id' => $user->id,
            'venue_id' => $venue->id,
            'time_slot_id' => $slot->id,
            'status' => 'pending',
        ]);

        $slot->refresh();
        $this->assertEquals(1, $slot->booked_courts);
    }

    public function test_unverified_user_cannot_book()
    {
        $user = User::factory()->create(['is_verified' => false]);
        Passport::actingAs($user);

        $venue = $this->createVenueWithSlots();
        $slot = $venue->timeSlots()->first();

        $response = $this->postJson('/api/bookings', [
            'venue_id' => $venue->id,
            'time_slot_id' => $slot->id,
        ]);

        $response->assertStatus(400)
            ->assertJson(['code' => 1]);
    }

    public function test_blacklisted_user_cannot_book()
    {
        $user = User::factory()->create([
            'is_verified' => true,
            'is_blacklisted' => true,
            'blacklist_until' => Carbon::now()->addDays(7),
        ]);
        Passport::actingAs($user);

        $venue = $this->createVenueWithSlots();
        $slot = $venue->timeSlots()->first();

        $response = $this->postJson('/api/bookings', [
            'venue_id' => $venue->id,
            'time_slot_id' => $slot->id,
        ]);

        $response->assertStatus(400);
    }

    public function test_user_can_cancel_booking()
    {
        $user = User::factory()->create(['is_verified' => true]);
        Passport::actingAs($user);

        $venue = $this->createVenueWithSlots();
        $slot = $venue->timeSlots()->first();

        $booking = Booking::factory()->create([
            'user_id' => $user->id,
            'venue_id' => $venue->id,
            'time_slot_id' => $slot->id,
            'status' => 'pending',
            'booking_date' => Carbon::tomorrow(),
            'start_time' => '09:00',
        ]);

        $slot->increment('booked_courts');

        $response = $this->postJson("/api/bookings/{$booking->id}/cancel");

        $response->assertStatus(200)
            ->assertJson(['code' => 0]);

        $booking->refresh();
        $this->assertEquals('cancelled', $booking->status);

        $slot->refresh();
        $this->assertEquals(0, $slot->booked_courts);
    }

    public function test_user_can_view_bookings()
    {
        $user = User::factory()->create(['is_verified' => true]);
        Passport::actingAs($user);

        Booking::factory()->count(3)->create(['user_id' => $user->id]);

        $response = $this->getJson('/api/bookings');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'code',
                'data' => ['total', 'list'],
            ])
            ->assertJson(['code' => 0]);
    }

    public function test_concurrent_booking_locks_slot()
    {
        $user = User::factory()->create(['is_verified' => true]);
        Passport::actingAs($user);

        $venue = Venue::factory()->create([
            'open_time' => '09:00',
            'close_time' => '10:00',
            'slot_duration' => 60,
            'base_price' => 50,
        ]);

        Court::factory()->create(['venue_id' => $venue->id]);

        $slot = TimeSlot::create([
            'venue_id' => $venue->id,
            'date' => Carbon::tomorrow()->format('Y-m-d'),
            'start_time' => '09:00',
            'end_time' => '10:00',
            'total_courts' => 1,
            'booked_courts' => 0,
            'price' => 50,
            'is_peak' => false,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/bookings', [
            'venue_id' => $venue->id,
            'time_slot_id' => $slot->id,
        ]);

        $response->assertStatus(200)
            ->assertJson(['code' => 0]);

        $user2 = User::factory()->create(['is_verified' => true]);
        Passport::actingAs($user2);

        $response2 = $this->postJson('/api/bookings', [
            'venue_id' => $venue->id,
            'time_slot_id' => $slot->id,
        ]);

        $response2->assertStatus(400);
    }
}
