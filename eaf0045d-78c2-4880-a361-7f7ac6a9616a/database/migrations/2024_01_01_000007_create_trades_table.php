<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trades', function (Blueprint $table) {
            $table->id();
            $table->string('trade_no', 50)->unique()->comment('成交编号');
            $table->unsignedBigInteger('listing_id')->comment('挂牌单ID');
            $table->unsignedBigInteger('seller_id')->comment('卖方ID');
            $table->unsignedBigInteger('buyer_id')->comment('买方ID');
            $table->string('energy_type', 20)->comment('能源类型');
            $table->integer('quantity')->comment('成交数量（张）');
            $table->decimal('unit_price', 10, 2)->comment('成交单价（元/张）');
            $table->decimal('total_amount', 14, 2)->comment('成交总金额');
            $table->string('status', 20)->default('pending')->comment('pending:待履约 performing:履约中 completed:已完成 breached:违约');
            $table->timestamp('matched_at')->useCurrent()->comment('成交时间');
            $table->timestamps();

            $table->foreign('listing_id')->references('id')->on('listings');
            $table->foreign('seller_id')->references('id')->on('users');
            $table->foreign('buyer_id')->references('id')->on('users');

            $table->index('seller_id');
            $table->index('buyer_id');
            $table->index('listing_id');
            $table->index('status');
            $table->index('matched_at');
            $table->index(['energy_type', 'matched_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trades');
    }
};
