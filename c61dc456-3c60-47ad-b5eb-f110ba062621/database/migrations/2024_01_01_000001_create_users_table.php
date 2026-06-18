<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('phone', 20)->unique();
            $table->string('password');
            $table->string('real_name', 50)->nullable();
            $table->string('id_card', 18)->nullable()->unique();
            $table->boolean('is_verified')->default(false);
            $table->integer('credit_score')->default(100);
            $table->boolean('is_blacklisted')->default(false);
            $table->timestamp('blacklist_until')->nullable();
            $table->integer('violation_count')->default(0);
            $table->rememberToken();
            $table->timestamps();
            $table->index('phone');
            $table->index('id_card');
            $table->index('is_blacklisted');
            $table->index('credit_score');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
