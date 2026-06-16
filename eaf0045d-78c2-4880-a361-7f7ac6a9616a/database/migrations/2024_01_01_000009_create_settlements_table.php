<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settlements', function (Blueprint $table) {
            $table->id();
            $table->string('settlement_no', 50)->unique()->comment('结算单号');
            $table->unsignedBigInteger('contract_id')->comment('合同ID');
            $table->unsignedBigInteger('user_id')->comment('结算用户ID');
            $table->string('settlement_type', 10)->comment('income:收入 expenditure:支出');
            $table->string('energy_type', 20)->comment('能源类型');
            $table->integer('certificate_quantity')->comment('绿证数量');
            $table->decimal('unit_price', 10, 2)->comment('单价');
            $table->decimal('trade_amount', 14, 2)->comment('交易金额');
            $table->decimal('service_fee', 14, 2)->comment('平台服务费');
            $table->decimal('net_amount', 14, 2)->comment('净额');
            $table->string('status', 20)->default('pending')->comment('pending:待结算 settled:已结算');
            $table->date('settlement_date')->comment('结算日期');
            $table->string('settlement_month', 7)->comment('结算月份');
            $table->text('remark')->nullable();
            $table->timestamps();

            $table->foreign('contract_id')->references('id')->on('contracts');
            $table->foreign('user_id')->references('id')->on('users');

            $table->index('user_id');
            $table->index('contract_id');
            $table->index('settlement_month');
            $table->index('status');
            $table->index(['user_id', 'settlement_month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settlements');
    }
};
