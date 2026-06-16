<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificate_balances', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('energy_type', 20)->comment('能源类型');
            $table->integer('available_balance')->default(0)->comment('可用余额（张）');
            $table->integer('frozen_balance')->default(0)->comment('冻结余额（张）');
            $table->integer('total_issued')->default(0)->comment('累计核发');
            $table->integer('total_traded')->default(0)->comment('累计交易');
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users');
            $table->unique(['user_id', 'energy_type']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificate_balances');
    }
};
