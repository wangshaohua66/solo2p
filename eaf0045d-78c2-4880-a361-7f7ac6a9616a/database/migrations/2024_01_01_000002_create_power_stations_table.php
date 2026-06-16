<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('power_stations', function (Blueprint $table) {
            $table->id();
            $table->string('station_code', 50)->unique()->comment('电站编号');
            $table->string('station_name', 200)->comment('电站名称');
            $table->string('energy_type', 20)->comment('solar:光伏 wind:风电');
            $table->decimal('installed_capacity', 12, 2)->comment('装机容量，单位：kW');
            $table->string('province', 50)->comment('省份');
            $table->string('city', 50)->nullable()->comment('城市');
            $table->string('address', 500)->nullable()->comment('详细地址');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->unsignedBigInteger('owner_id')->comment('所属用户ID');
            $table->string('status', 20)->default('active')->comment('active:正常 suspended:暂停');
            $table->date('grid_connection_date')->nullable()->comment('并网日期');
            $table->text('remark')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('owner_id')->references('id')->on('users');
            $table->index('owner_id');
            $table->index('energy_type');
            $table->index('province');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('power_stations');
    }
};
