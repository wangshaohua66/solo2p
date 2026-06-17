<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->uuid('uuid')->unique();
            $table->string('name', 128);
            $table->string('email', 255);
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password', 255);
            $table->string('phone', 32)->nullable();
            $table->string('avatar', 512)->nullable();
            $table->string('job_title', 128)->nullable();
            $table->string('department', 128)->nullable();
            $table->tinyInteger('type')->default(2)->comment('1:owner,2:agent,3:customer');
            $table->tinyInteger('status')->default(1)->comment('1:active,2:inactive,3:banned');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_online')->default(false);
            $table->string('timezone', 64)->default('Asia/Shanghai');
            $table->string('language', 16)->default('zh_CN');
            $table->timestamp('last_active_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'email']);
            $table->index(['tenant_id', 'type', 'status']);
            $table->index(['tenant_id', 'is_online']);
            $table->index('last_active_at');

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
