<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('uuid')->unique();
            $table->string('name', 255);
            $table->string('subdomain', 64)->unique();
            $table->string('email', 255);
            $table->string('billing_email', 255)->nullable();
            $table->string('phone', 32)->nullable();
            $table->string('industry', 128)->nullable();
            $table->string('company_size', 64)->nullable();
            $table->unsignedInteger('employee_count')->nullable();
            $table->string('timezone', 64)->default('Asia/Shanghai');
            $table->string('language', 16)->default('zh-CN');
            $table->string('currency', 8)->default('CNY');
            $table->tinyInteger('status')->default(1)->comment('1:active,2:suspended,3:cancelled');
            $table->boolean('is_active')->default(true);
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('subscription_ends_at')->nullable();
            $table->string('plan', 64)->default('free');
            $table->string('billing_plan', 64)->default('free');
            $table->json('settings')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'billing_plan']);
            $table->index('subscription_ends_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenants');
    }
};
