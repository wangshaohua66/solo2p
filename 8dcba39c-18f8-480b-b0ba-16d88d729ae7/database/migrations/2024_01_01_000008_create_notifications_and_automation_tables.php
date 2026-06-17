<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_templates', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->string('key', 64);
            $table->string('name', 128);
            $table->string('channel', 32)->comment('email,sms,webhook,in_app');
            $table->string('subject', 255)->nullable();
            $table->text('body');
            $table->json('variables')->nullable();
            $table->boolean('is_system')->default(false);
            $table->boolean('is_enabled')->default(true);
            $table->boolean('status')->default(1);
            $table->string('language', 16)->default('zh-CN');
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'key', 'channel', 'language']);
            $table->index(['tenant_id', 'channel', 'is_enabled']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        Schema::create('notification_subscriptions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('event_key', 64);
            $table->json('channels');
            $table->json('target_roles')->nullable();
            $table->boolean('is_system')->default(false);
            $table->boolean('enabled')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'user_id', 'event_key']);
            $table->index(['tenant_id', 'event_key', 'enabled']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });

        Schema::create('notification_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->string('channel', 32);
            $table->string('event', 64)->nullable();
            $table->unsignedBigInteger('template_id')->nullable();
            $table->unsignedBigInteger('ticket_id')->nullable();
            $table->unsignedBigInteger('recipient_user_id')->nullable();
            $table->string('recipient', 255);
            $table->string('subject', 255)->nullable();
            $table->text('body')->nullable();
            $table->json('variables')->nullable();
            $table->tinyInteger('status')->default(0)->comment('0:pending,1:sent,2:failed,3:delivered');
            $table->text('error_message')->nullable();
            $table->string('provider', 64)->nullable();
            $table->string('provider_message_id', 255)->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->unsignedInteger('retry_count')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'channel', 'created_at']);
            $table->index(['tenant_id', 'status', 'created_at']);
            $table->index(['ticket_id', 'event']);
            $table->index(['status', 'sent_at']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        Schema::create('webhook_endpoints', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->string('name', 128);
            $table->string('url', 512);
            $table->string('method', 16)->default('POST');
            $table->json('listens_to');
            $table->json('headers')->nullable();
            $table->string('signing_secret', 255)->nullable();
            $table->string('auth_type', 32)->default('none')->comment('none,api_key,bearer,basic');
            $table->json('auth_credentials')->nullable();
            $table->unsignedInteger('timeout_seconds')->default(30);
            $table->boolean('verify_ssl')->default(true);
            $table->tinyInteger('status')->default(1)->comment('1:active,0:inactive,2:disabled_failed');
            $table->unsignedInteger('failure_count')->default(0);
            $table->timestamp('last_success_at')->nullable();
            $table->timestamp('last_failure_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'status']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        Schema::create('webhook_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('endpoint_id');
            $table->string('event', 64);
            $table->unsignedBigInteger('ticket_id')->nullable();
            $table->json('request_headers')->nullable();
            $table->text('request_body');
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->text('response_body')->nullable();
            $table->unsignedInteger('response_time_ms')->nullable();
            $table->boolean('success');
            $table->text('error_message')->nullable();
            $table->unsignedInteger('retry_count')->default(0);
            $table->timestamps();

            $table->index(['tenant_id', 'event', 'created_at']);
            $table->index(['endpoint_id', 'success', 'created_at']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('endpoint_id')->references('id')->on('webhook_endpoints')->onDelete('cascade');
        });

        Schema::create('automation_rules', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->string('name', 128);
            $table->text('description')->nullable();
            $table->string('trigger_type', 32)->comment('event,schedule,condition');
            $table->string('schedule_cron', 64)->nullable();
            $table->json('trigger_conditions')->nullable();
            $table->json('conditions')->nullable();
            $table->json('actions');
            $table->boolean('stop_on_error')->default(true);
            $table->boolean('stop_on_match')->default(false);
            $table->unsignedInteger('priority')->default(0);
            $table->tinyInteger('status')->default(1);
            $table->timestamp('last_run_at')->nullable();
            $table->timestamp('last_triggered_at')->nullable();
            $table->unsignedBigInteger('trigger_count')->default(0);
            $table->timestamps();

            $table->index(['tenant_id', 'status', 'trigger_type', 'priority']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        Schema::create('automation_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('rule_id');
            $table->string('trigger_type', 32);
            $table->string('event', 64)->nullable();
            $table->string('entity_type', 128)->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->boolean('triggered');
            $table->unsignedInteger('actions_executed')->default(0);
            $table->unsignedInteger('actions_total')->default(0);
            $table->unsignedInteger('execution_ms')->default(0);
            $table->json('errors')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'rule_id', 'created_at']);
            $table->index(['tenant_id', 'entity_type', 'entity_id', 'created_at']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('rule_id')->references('id')->on('automation_rules')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_logs');
        Schema::dropIfExists('automation_rules');
        Schema::dropIfExists('webhook_logs');
        Schema::dropIfExists('webhook_endpoints');
        Schema::dropIfExists('notification_logs');
        Schema::dropIfExists('notification_subscriptions');
        Schema::dropIfExists('notification_templates');
    }
};
