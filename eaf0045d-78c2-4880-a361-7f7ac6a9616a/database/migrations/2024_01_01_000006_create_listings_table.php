<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('listings', function (Blueprint $table) {
            $table->id();
            $table->string('listing_no', 50)->unique()->comment('挂牌单号');
            $table->unsignedBigInteger('seller_id')->comment('卖方ID');
            $table->string('energy_type', 20)->comment('能源类型');
            $table->integer('total_quantity')->comment('挂牌总数量（张）');
            $table->integer('available_quantity')->comment('可成交数量（张）');
            $table->integer('traded_quantity')->default(0)->comment('已成交数量（张）');
            $table->decimal('unit_price', 10, 2)->comment('单价（元/张）');
            $table->string('status', 20)->default('active')->comment('active:挂牌中 partial:部分成交 done:全部成交 cancelled:已撤销 expired:已过期');
            $table->timestamp('expires_at')->nullable()->comment('挂牌有效期');
            $table->text('remark')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('seller_id')->references('id')->on('users');
            $table->index('seller_id');
            $table->index(['energy_type', 'status']);
            $table->index(['status', 'unit_price', 'created_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listings');
    }
};
