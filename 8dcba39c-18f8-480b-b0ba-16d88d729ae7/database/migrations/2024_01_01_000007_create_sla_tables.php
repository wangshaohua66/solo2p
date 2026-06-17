<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sla_policies', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->string('name', 128);
            $table->text('description')->nullable();
            $table->json('conditions')->nullable();
            $table->unsignedInteger('first_response_minutes')->nullable();
            $table->unsignedInteger('response_minutes')->nullable();
            $table->unsignedInteger('resolution_minutes')->nullable();
            $table->decimal('target_fcr_percent', 5, 2)->nullable();
            $table->decimal('target_resolution_percent', 5, 2)->nullable();
            $table->json('business_hours')->nullable();
            $table->boolean('apply_holidays')->default(false);
            $table->json('escalation_rules')->nullable();
            $table->boolean('use_business_hours')->default(true);
            $table->boolean('is_default')->default(false);
            $table->boolean('pause_on_pending')->default(true);
            $table->string('pending_statuses', 255)->default('pending,on_hold');
            $table->tinyInteger('status')->default(1);
            $table->unsignedInteger('priority')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'status', 'priority']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        Schema::create('sla_timers', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('ticket_id');
            $table->unsignedBigInteger('sla_policy_id');
            $table->string('timer_type', 32)->comment('first_response,response,resolution');
            $table->timestamp('started_at');
            $table->timestamp('paused_at')->nullable();
            $table->timestamp('resumed_at')->nullable();
            $table->timestamp('target_at');
            $table->timestamp('completed_at')->nullable();
            $table->unsignedBigInteger('elapsed_seconds')->default(0);
            $table->unsignedBigInteger('paused_seconds')->default(0);
            $table->decimal('breach_percent', 8, 2)->default(0);
            $table->tinyInteger('status')->default(1)->comment('1:running,2:paused,3:completed,4:breached');
            $table->timestamps();

            $table->index(['tenant_id', 'ticket_id']);
            $table->index(['sla_policy_id', 'status']);
            $table->index(['status', 'target_at']);
            $table->unique(['ticket_id', 'timer_type']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('ticket_id')->references('id')->on('tickets')->onDelete('cascade');
            $table->foreign('sla_policy_id')->references('id')->on('sla_policies')->onDelete('cascade');
        });

        Schema::create('sla_violations', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('ticket_id');
            $table->unsignedBigInteger('timer_id');
            $table->unsignedBigInteger('sla_policy_id');
            $table->string('violation_type', 32);
            $table->timestamp('violated_at');
            $table->unsignedBigInteger('breach_seconds');
            $table->unsignedInteger('escalation_level')->default(1);
            $table->boolean('notified')->default(false);
            $table->timestamp('notified_at')->nullable();
            $table->json('notified_users')->nullable();
            $table->unsignedInteger('level')->default(1);
            $table->string('type', 32)->nullable();
            $table->unsignedBigInteger('policy_id')->nullable();
            $table->timestamp('breached_at')->nullable();
            $table->unsignedInteger('target_minutes')->nullable();
            $table->unsignedInteger('actual_minutes')->nullable();
            $table->boolean('acknowledged')->default(false);
            $table->timestamps();

            $table->index(['tenant_id', 'ticket_id']);
            $table->index(['tenant_id', 'violated_at']);
            $table->index(['sla_policy_id', 'violation_type']);
            $table->index(['level', 'acknowledged']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('ticket_id')->references('id')->on('tickets')->onDelete('cascade');
            $table->foreign('timer_id')->references('id')->on('sla_timers')->onDelete('cascade');
        });

        Schema::create('sla_metrics', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('sla_policy_id')->nullable();
            $table->date('metric_date');
            $table->string('metric_type', 32)->default('daily')->comment('daily,first_response,resolution');
            $table->unsignedBigInteger('total_count')->default(0);
            $table->unsignedBigInteger('on_time_count')->default(0);
            $table->unsignedBigInteger('breach_count')->default(0);
            $table->unsignedBigInteger('total_minutes')->default(0);
            $table->unsignedBigInteger('total_tickets')->default(0);
            $table->unsignedBigInteger('first_response_met')->default(0);
            $table->unsignedBigInteger('first_response_violated')->default(0);
            $table->unsignedBigInteger('resolution_met')->default(0);
            $table->unsignedBigInteger('resolution_violated')->default(0);
            $table->decimal('avg_first_response_minutes', 12, 2)->default(0);
            $table->decimal('avg_resolution_minutes', 12, 2)->default(0);
            $table->decimal('avg_wait_time_minutes', 12, 2)->default(0);
            $table->decimal('fcr_rate', 5, 2)->default(0);
            $table->decimal('sla_compliance_rate', 5, 2)->default(0);
            $table->timestamps();

            $table->unique(['tenant_id', 'metric_date', 'sla_policy_id', 'metric_type']);
            $table->index(['tenant_id', 'metric_date']);
            $table->index(['tenant_id', 'metric_type', 'metric_date']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        Schema::create('business_hours', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedTinyInteger('day_of_week')->comment('0:Sunday-6:Saturday');
            $table->string('name', 32)->nullable();
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->boolean('is_workday')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'day_of_week']);
            $table->index(['tenant_id', 'is_workday']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_hours');
        Schema::dropIfExists('sla_metrics');
        Schema::dropIfExists('sla_violations');
        Schema::dropIfExists('sla_timers');
        Schema::dropIfExists('sla_policies');
    }
};
