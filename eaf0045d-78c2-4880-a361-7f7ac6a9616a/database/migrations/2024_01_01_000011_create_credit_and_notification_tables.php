<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credit_score_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->integer('score_before')->comment('变更前信用分');
            $table->integer('score_change')->comment('变更值（正负）');
            $table->integer('score_after')->comment('变更后信用分');
            $table->string('reason', 200)->comment('变更原因');
            $table->string('related_type', 50)->nullable()->comment('关联业务类型');
            $table->unsignedBigInteger('related_id')->nullable()->comment('关联业务ID');
            $table->unsignedBigInteger('operator_id')->nullable()->comment('操作人ID');
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users');
            $table->foreign('operator_id')->references('id')->on('users');

            $table->index('user_id');
            $table->index('created_at');
        });

        Schema::create('certificate_transfers', function (Blueprint $table) {
            $table->id();
            $table->string('transfer_no', 50)->unique()->comment('流转编号');
            $table->unsignedBigInteger('from_user_id')->comment('转出方ID');
            $table->unsignedBigInteger('to_user_id')->comment('转入方ID');
            $table->string('energy_type', 20)->comment('能源类型');
            $table->integer('quantity')->comment('数量（张）');
            $table->string('transfer_type', 30)->comment('issue:核发 trade:交易 transfer:划转 freeze:冻结 unfreeze:解冻');
            $table->unsignedBigInteger('related_id')->nullable()->comment('关联业务ID');
            $table->string('related_type', 50)->nullable()->comment('关联业务类型');
            $table->text('remark')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('from_user_id')->references('id')->on('users');
            $table->foreign('to_user_id')->references('id')->on('users');

            $table->index('from_user_id');
            $table->index('to_user_id');
            $table->index('transfer_type');
            $table->index('created_at');
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('type', 50)->comment('通知类型');
            $table->string('title', 200)->comment('标题');
            $table->text('content')->comment('内容');
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->string('related_type', 50)->nullable();
            $table->unsignedBigInteger('related_id')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users');
            $table->index('user_id');
            $table->index('is_read');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('certificate_transfers');
        Schema::dropIfExists('credit_score_logs');
    }
};
