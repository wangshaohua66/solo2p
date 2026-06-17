<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflows', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->string('name', 128);
            $table->text('description')->nullable();
            $table->string('trigger_type', 64)->default('manual')->comment('manual,auto,condition');
            $table->json('trigger_conditions')->nullable();
            $table->string('entity_type', 64)->default('ticket');
            $table->unsignedBigInteger('initial_state_id')->nullable();
            $table->boolean('is_default')->default(false);
            $table->tinyInteger('status')->default(1)->comment('1:active,0:inactive');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'entity_type', 'status']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        Schema::create('workflow_states', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('workflow_id');
            $table->string('name', 64);
            $table->string('key', 64);
            $table->string('color', 32)->nullable();
            $table->string('category', 32)->default('active')->comment('active,pending,resolved,closed');
            $table->boolean('is_initial')->default(false);
            $table->boolean('is_final')->default(false);
            $table->json('on_enter_actions')->nullable();
            $table->json('on_exit_actions')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['workflow_id', 'key']);
            $table->index(['tenant_id', 'workflow_id']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('workflow_id')->references('id')->on('workflows')->onDelete('cascade');
        });

        Schema::create('workflow_transitions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('workflow_id');
            $table->unsignedBigInteger('from_state_id');
            $table->unsignedBigInteger('to_state_id');
            $table->string('name', 128);
            $table->json('conditions')->nullable();
            $table->json('actions')->nullable();
            $table->boolean('requires_approval')->default(false);
            $table->json('approver_roles')->nullable();
            $table->unsignedBigInteger('approval_group_id')->nullable();
            $table->unsignedInteger('approval_timeout_minutes')->nullable();
            $table->json('notifications')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['tenant_id', 'workflow_id']);
            $table->index(['from_state_id', 'to_state_id']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('workflow_id')->references('id')->on('workflows')->onDelete('cascade');
            $table->foreign('from_state_id')->references('id')->on('workflow_states')->onDelete('cascade');
            $table->foreign('to_state_id')->references('id')->on('workflow_states')->onDelete('cascade');
        });

        Schema::create('workflow_approvals', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('ticket_id');
            $table->unsignedBigInteger('transition_id');
            $table->unsignedBigInteger('requested_by');
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->tinyInteger('status')->default(1)->comment('1:pending,2:approved,3:rejected,4:expired');
            $table->text('reject_reason')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['ticket_id', 'status']);
            $table->index('expires_at');
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('ticket_id')->references('id')->on('tickets')->onDelete('cascade');
            $table->foreign('transition_id')->references('id')->on('workflow_transitions')->onDelete('cascade');
        });

        Schema::create('assignment_rules', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->string('name', 128);
            $table->text('description')->nullable();
            $table->json('conditions');
            $table->string('assignment_type', 32)->comment('agent,group,round_robin,skill_based,least_loaded');
            $table->unsignedBigInteger('assigned_user_id')->nullable();
            $table->unsignedBigInteger('assigned_group_id')->nullable();
            $table->json('user_ids')->nullable();
            $table->json('group_ids')->nullable();
            $table->boolean('reassign_if_unavailable')->default(true);
            $table->unsignedInteger('max_tickets_per_agent')->nullable();
            $table->unsignedInteger('priority')->default(0);
            $table->tinyInteger('status')->default(1);
            $table->timestamps();

            $table->index(['tenant_id', 'status', 'priority']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('assigned_user_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('assigned_group_id')->references('id')->on('ticket_groups')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assignment_rules');
        Schema::dropIfExists('workflow_approvals');
        Schema::dropIfExists('workflow_transitions');
        Schema::dropIfExists('workflow_states');
        Schema::dropIfExists('workflows');
    }
};
