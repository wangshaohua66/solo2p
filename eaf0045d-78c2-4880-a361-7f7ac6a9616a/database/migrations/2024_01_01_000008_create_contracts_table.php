<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contracts', function (Blueprint $table) {
            $table->id();
            $table->string('contract_no', 50)->unique()->comment('合同编号');
            $table->unsignedBigInteger('trade_id')->comment('交易ID');
            $table->unsignedBigInteger('seller_id')->comment('卖方ID');
            $table->unsignedBigInteger('buyer_id')->comment('买方ID');
            $table->string('energy_type', 20)->comment('能源类型');
            $table->integer('quantity')->comment('绿证数量（张）');
            $table->decimal('unit_price', 10, 2)->comment('单价（元/张）');
            $table->decimal('total_amount', 14, 2)->comment('合同总金额');
            $table->date('delivery_deadline')->comment('交割截止日期');
            $table->string('status', 20)->default('signed')->comment('signed:已签订 performing:履约中 delivered:已交割 completed:已完成 breached:违约 cancelled:已取消');
            $table->timestamp('signed_at')->useCurrent()->comment('签订时间');
            $table->timestamp('delivery_at')->nullable()->comment('交割时间');
            $table->timestamp('completed_at')->nullable()->comment('完成时间');
            $table->boolean('reminder_3d_sent')->default(false)->comment('到期前3天提醒已发送');
            $table->boolean('reminder_1d_sent')->default(false)->comment('到期前1天提醒已发送');
            $table->text('breach_reason')->nullable()->comment('违约原因');
            $table->text('remark')->nullable();
            $table->timestamps();

            $table->foreign('trade_id')->references('id')->on('trades');
            $table->foreign('seller_id')->references('id')->on('users');
            $table->foreign('buyer_id')->references('id')->on('users');

            $table->index('seller_id');
            $table->index('buyer_id');
            $table->index('status');
            $table->index('delivery_deadline');
            $table->index(['status', 'delivery_deadline']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contracts');
    }
};
