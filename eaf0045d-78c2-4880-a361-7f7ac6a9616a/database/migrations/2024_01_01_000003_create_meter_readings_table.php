<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meter_readings', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('station_id');
            $table->string('report_month', 7)->comment('上报月份 YYYY-MM');
            $table->decimal('generation_kwh', 14, 2)->comment('发电量，单位：kWh');
            $table->decimal('theoretical_max_kwh', 14, 2)->comment('理论最大发电量');
            $table->string('status', 20)->default('pending')->comment('pending:待审核 normal:正常 abnormal:异常 approved:审核通过 rejected:审核驳回');
            $table->text('abnormal_reason')->nullable()->comment('异常原因');
            $table->unsignedBigInteger('reported_by')->comment('上报人ID');
            $table->unsignedBigInteger('reviewed_by')->nullable()->comment('审核人ID');
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_remark')->nullable();
            $table->timestamps();

            $table->foreign('station_id')->references('id')->on('power_stations');
            $table->foreign('reported_by')->references('id')->on('users');
            $table->foreign('reviewed_by')->references('id')->on('users');

            $table->unique(['station_id', 'report_month']);
            $table->index('report_month');
            $table->index('status');
            $table->index('station_id', 'report_month', 'status');
        });

        DB::statement("
            CREATE TABLE meter_readings_partition_template ()
            INHERITS (meter_readings);
        ");

        DB::statement("
            CREATE OR REPLACE FUNCTION create_meter_readings_partition()
            RETURNS TRIGGER AS $$
            DECLARE
                partition_date TEXT;
                partition_name TEXT;
            BEGIN
                partition_date := NEW.report_month;
                partition_name := 'meter_readings_' || replace(partition_date, '-', '_');

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name = partition_name
                ) THEN
                    EXECUTE format(
                        'CREATE TABLE %I PARTITION OF meter_readings
                        FOR VALUES IN (%L)',
                        partition_name,
                        partition_date
                    );
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        ");

        DB::statement("
            CREATE TRIGGER trigger_meter_readings_partition
            BEFORE INSERT ON meter_readings
            FOR EACH ROW EXECUTE FUNCTION create_meter_readings_partition();
        ");
    }

    public function down(): void
    {
        DB::statement("DROP TRIGGER IF EXISTS trigger_meter_readings_partition ON meter_readings;");
        DB::statement("DROP FUNCTION IF EXISTS create_meter_readings_partition();");
        Schema::dropIfExists('meter_readings');
    }
};
