<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificate_remainders', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('station_id');
            $table->string('report_month', 7)->comment('月份 YYYY-MM');
            $table->decimal('remainder_kwh', 14, 2)->default(0)->comment('余数kWh（不足1MWh部分）');
            $table->decimal('original_generation_kwh', 14, 2)->comment('当月原始发电量');
            $table->decimal('total_kwh', 14, 2)->comment('当月含上月累计余数的总发电量');
            $table->integer('issued_quantity')->comment('当月核发绿证数量');
            $table->timestamps();

            $table->foreign('station_id')->references('id')->on('power_stations');
            $table->unique(['station_id', 'report_month']);
            $table->index('station_id');
            $table->index('report_month');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificate_remainders');
    }
};
