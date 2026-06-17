<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('in_app_notifications', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('notification_log_id')->nullable();
            $table->unsignedBigInteger('ticket_id')->nullable();
            $table->string('title', 255);
            $table->text('body')->nullable();
            $table->json('data')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'user_id', 'is_read', 'created_at']);
            $table->index(['tenant_id', 'ticket_id']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('ticket_id')->references('id')->on('tickets')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('in_app_notifications');
    }
};
