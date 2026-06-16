<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificates', function (Blueprint $table) {
            $table->id();
            $table->string('certificate_no', 50)->unique()->comment('绿证编号');
            $table->unsignedBigInteger('station_id');
            $table->unsignedBigInteger('owner_id')->comment('持证人ID');
            $table->string('issue_month', 7)->comment('核发月份 YYYY-MM');
            $table->integer('quantity')->comment('绿证数量，单位：张（1张=1MWh）');
            $table->decimal('generation_kwh', 14, 2)->comment('对应发电量kWh');
            $table->string('energy_type', 20)->comment('能源类型');
            $table->string('province', 50)->comment('省份');
            $table->unsignedBigInteger('issuer_id')->comment('核发人ID');
            $table->text('remark')->nullable();
            $table->timestamp('issued_at')->useCurrent();

            $table->foreign('station_id')->references('id')->on('power_stations');
            $table->foreign('owner_id')->references('id')->on('users');
            $table->foreign('issuer_id')->references('id')->on('users');

            $table->index('owner_id');
            $table->index('station_id');
            $table->index('issue_month');
            $table->index('energy_type');
            $table->index('province');
        });

        DB::statement("ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;");
    }

    public function down(): void
    {
        Schema::dropIfExists('certificates');
    }
};
