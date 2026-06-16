<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id')->nullable()->comment('操作人ID');
            $table->string('username', 50)->nullable()->comment('操作人用户名');
            $table->string('role', 20)->nullable()->comment('操作人角色');
            $table->string('action', 50)->comment('操作类型');
            $table->string('business_type', 50)->comment('业务类型');
            $table->string('business_id', 50)->nullable()->comment('业务记录ID');
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->jsonb('before_data')->nullable()->comment('变更前数据');
            $table->jsonb('after_data')->nullable()->comment('变更后数据');
            $table->text('remark')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('user_id');
            $table->index('business_type');
            $table->index('action');
            $table->index('created_at');
            $table->index(['business_type', 'business_id']);
            $table->index(['created_at', 'business_type']);
        });

        DB::statement("
            SELECT create_hypertable('audit_logs', 'created_at',
                chunk_time_interval => INTERVAL '1 month',
                if_not_exists => TRUE
            );
        ");
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
