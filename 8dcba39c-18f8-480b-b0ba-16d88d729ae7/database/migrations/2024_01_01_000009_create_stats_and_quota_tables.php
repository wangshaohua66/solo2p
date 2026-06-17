<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_stats', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('group_id')->nullable();
            $table->unsignedBigInteger('category_id')->nullable();
            $table->string('stat_type', 64)->comment('daily,hourly,agent,group,category,source,priority');
            $table->date('stat_date');
            $table->unsignedTinyInteger('stat_hour')->nullable();

            $table->unsignedBigInteger('tickets_created')->default(0);
            $table->unsignedBigInteger('tickets_updated')->default(0);
            $table->unsignedBigInteger('tickets_resolved')->default(0);
            $table->unsignedBigInteger('tickets_closed')->default(0);
            $table->unsignedBigInteger('tickets_reopened')->default(0);
            $table->unsignedBigInteger('tickets_deleted')->default(0);

            $table->unsignedBigInteger('tickets_open')->default(0);
            $table->unsignedBigInteger('tickets_in_progress')->default(0);
            $table->unsignedBigInteger('tickets_pending')->default(0);
            $table->unsignedBigInteger('tickets_overdue')->default(0);

            $table->unsignedBigInteger('replies_sent')->default(0);
            $table->unsignedBigInteger('notes_added')->default(0);
            $table->unsignedBigInteger('comments_total')->default(0);

            $table->decimal('avg_first_response_minutes', 12, 2)->default(0);
            $table->decimal('avg_response_minutes', 12, 2)->default(0);
            $table->decimal('avg_resolution_minutes', 12, 2)->default(0);
            $table->decimal('avg_wait_time_minutes', 12, 2)->default(0);
            $table->decimal('avg_touches', 8, 2)->default(0);
            $table->decimal('avg_reopens', 5, 2)->default(0);

            $table->unsignedBigInteger('sla_breached_first_response')->default(0);
            $table->unsignedBigInteger('sla_breached_resolution')->default(0);
            $table->decimal('sla_compliance_rate', 5, 2)->default(100);
            $table->decimal('fcr_rate', 5, 2)->default(0);

            $table->decimal('avg_satisfaction_score', 2, 1)->default(0);
            $table->unsignedBigInteger('satisfaction_responses')->default(0);
            $table->unsignedBigInteger('satisfaction_positive')->default(0);
            $table->unsignedBigInteger('satisfaction_negative')->default(0);

            $table->json('breakdown_data')->nullable();

            $table->unsignedBigInteger('first_response_total_seconds')->default(0);
            $table->unsignedBigInteger('response_total_seconds')->default(0);
            $table->unsignedBigInteger('resolution_total_seconds')->default(0);
            $table->unsignedBigInteger('satisfaction_score_sum')->default(0);
            $table->unsignedBigInteger('fcr_count')->default(0);

            $table->timestamps();

            $table->unique(['tenant_id', 'stat_type', 'stat_date', 'stat_hour', 'user_id', 'group_id', 'category_id'], 'stats_unique');
            $table->index(['tenant_id', 'stat_type', 'stat_date']);
            $table->index(['tenant_id', 'user_id', 'stat_date']);
            $table->index(['tenant_id', 'group_id', 'stat_date']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        Schema::create('tenant_quotas', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->string('resource', 64);
            $table->unsignedBigInteger('quota_limit');
            $table->unsignedBigInteger('usage_current')->default(0);
            $table->date('usage_date');
            $table->timestamps();

            $table->unique(['tenant_id', 'resource', 'usage_date']);
            $table->index(['tenant_id', 'resource']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        Schema::create('billing_records', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->string('invoice_number', 64)->unique();
            $table->decimal('amount', 12, 2);
            $table->string('currency', 8)->default('CNY');
            $table->string('billing_period', 32);
            $table->date('billing_start_date');
            $table->date('billing_end_date');
            $table->timestamp('due_date');
            $table->timestamp('paid_at')->nullable();
            $table->tinyInteger('status')->default(1)->comment('1:draft,2:issued,3:paid,4:overdue,5:refunded');
            $table->string('payment_method', 32)->nullable();
            $table->json('items')->nullable();
            $table->json('tax_info')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status', 'billing_start_date']);
            $table->index('due_date');
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        Schema::create('activity_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('log_name', 64)->nullable();
            $table->text('description');
            $table->string('subject_type', 128)->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->json('properties')->nullable();
            $table->string('ip_address', 64)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'log_name', 'created_at']);
            $table->index(['subject_type', 'subject_id']);
            $table->index(['tenant_id', 'user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('billing_records');
        Schema::dropIfExists('tenant_quotas');
        Schema::dropIfExists('report_stats');
    }
};
