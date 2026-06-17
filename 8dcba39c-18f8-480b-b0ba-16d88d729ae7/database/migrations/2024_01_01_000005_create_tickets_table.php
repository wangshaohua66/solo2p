<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->uuid('uuid')->unique();
            $table->string('number', 32);
            $table->string('subject', 255);
            $table->text('content')->nullable();
            $table->unsignedBigInteger('category_id')->nullable();
            $table->unsignedBigInteger('subcategory_id')->nullable();
            $table->string('source', 32)->default('web')->comment('web,email,phone,api,chat,social');
            $table->string('channel', 32)->default('default');
            $table->tinyInteger('priority')->default(3)->comment('1:low,2:medium,3:high,4:urgent');
            $table->string('status', 32)->default('open')->comment('open,in_progress,pending,resolved,closed,reopened');
            $table->unsignedBigInteger('requester_id');
            $table->unsignedBigInteger('assignee_id')->nullable();
            $table->unsignedBigInteger('group_id')->nullable();
            $table->unsignedBigInteger('workflow_id')->nullable();
            $table->unsignedBigInteger('current_state_id')->nullable();
            $table->unsignedBigInteger('sla_policy_id')->nullable();
            $table->decimal('satisfaction_score', 2, 1)->nullable();
            $table->text('satisfaction_comment')->nullable();
            $table->timestamp('satisfaction_submitted_at')->nullable();
            $table->timestamp('due_at')->nullable();
            $table->timestamp('first_response_at')->nullable();
            $table->timestamp('last_assigned_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->unsignedBigInteger('reopen_count')->default(0);
            $table->unsignedBigInteger('comment_count')->default(0);
            $table->unsignedBigInteger('attachment_count')->default(0);
            $table->json('custom_fields')->nullable();
            $table->json('tags')->nullable();
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'number']);
            $table->index(['tenant_id', 'status', 'priority']);
            $table->index(['tenant_id', 'requester_id']);
            $table->index(['tenant_id', 'assignee_id', 'status']);
            $table->index(['tenant_id', 'group_id', 'status']);
            $table->index(['tenant_id', 'created_at']);
            $table->index(['tenant_id', 'due_at']);
            $table->index(['tenant_id', 'resolved_at']);
            $table->index(['tenant_id', 'category_id']);
            $table->index(['tenant_id', 'source', 'status']);
            $table->index(['status', 'due_at']);
            $table->index('satisfaction_score');

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('requester_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('assignee_id')->references('id')->on('users')->onDelete('set null');
        });

        Schema::create('ticket_comments', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('ticket_id');
            $table->unsignedBigInteger('user_id');
            $table->text('content');
            $table->string('type', 32)->default('reply')->comment('reply,note,system');
            $table->boolean('is_public')->default(true);
            $table->boolean('is_first_response')->default(false);
            $table->unsignedBigInteger('attachment_count')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'ticket_id', 'created_at']);
            $table->index(['tenant_id', 'user_id']);
            $table->index(['ticket_id', 'type']);

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('ticket_id')->references('id')->on('tickets')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });

        Schema::create('ticket_histories', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('ticket_id');
            $table->unsignedBigInteger('user_id');
            $table->string('action', 64);
            $table->text('old_value')->nullable();
            $table->text('new_value')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'ticket_id', 'created_at']);
            $table->index(['tenant_id', 'user_id', 'action']);
            $table->index('action');

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('ticket_id')->references('id')->on('tickets')->onDelete('cascade');
        });

        Schema::create('ticket_attachments', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('ticket_id')->nullable();
            $table->unsignedBigInteger('comment_id')->nullable();
            $table->string('filename', 255);
            $table->string('original_name', 255);
            $table->string('mime_type', 128);
            $table->unsignedBigInteger('size');
            $table->string('storage_path', 512);
            $table->unsignedBigInteger('uploaded_by');
            $table->timestamps();

            $table->index(['tenant_id', 'ticket_id']);
            $table->index('comment_id');

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('ticket_id')->references('id')->on('tickets')->onDelete('set null');
        });

        Schema::create('ticket_categories', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('name', 128);
            $table->string('slug', 128);
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->tinyInteger('status')->default(1);
            $table->timestamps();

            $table->unique(['tenant_id', 'slug']);
            $table->index(['tenant_id', 'parent_id']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        Schema::create('ticket_tags', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->string('name', 64);
            $table->string('color', 32)->nullable();
            $table->unsignedBigInteger('usage_count')->default(0);
            $table->timestamps();

            $table->unique(['tenant_id', 'name']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        Schema::create('ticket_groups', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->string('name', 128);
            $table->text('description')->nullable();
            $table->unsignedBigInteger('leader_id')->nullable();
            $table->string('escalation_email', 255)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->tinyInteger('status')->default(1);
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_groups');
        Schema::dropIfExists('ticket_tags');
        Schema::dropIfExists('ticket_categories');
        Schema::dropIfExists('ticket_attachments');
        Schema::dropIfExists('ticket_histories');
        Schema::dropIfExists('ticket_comments');
        Schema::dropIfExists('tickets');
    }
};
