<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $currentYear = date('Y');
        $startYear = $currentYear - 2;
        $endYear = $currentYear + 1;

        Schema::create('price_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('card_id')->constrained()->onDelete('cascade');
            $table->decimal('price_usd', 10, 2)->nullable();
            $table->decimal('price_eur', 10, 2)->nullable();
            $table->decimal('price_tix', 10, 2)->nullable();
            $table->string('source')->default('scryfall');
            $table->date('price_date')->index();
            $table->timestamps();

            $table->index(['card_id', 'price_date']);
        });

        $unionParts = [];
        for ($year = $startYear; $year <= $endYear; $year++) {
            for ($month = 1; $month <= 12; $month++) {
                $tableName = sprintf('price_histories_%04d_%02d', $year, $month);
                $startDate = sprintf('%04d-%02d-01', $year, $month);
                $endDate = date('Y-m-t', strtotime($startDate));

                DB::statement("
                    CREATE TABLE {$tableName} (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        card_id INTEGER NOT NULL,
                        price_usd DECIMAL(10,2),
                        price_eur DECIMAL(10,2) NULL,
                        price_tix DECIMAL(10,2),
                        source VARCHAR(255) DEFAULT 'scryfall',
                        price_date DATE NOT NULL,
                        created_at TIMESTAMP NULL,
                        updated_at TIMESTAMP NULL,
                        FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
                    )
                ");

                DB::statement("CREATE INDEX idx_{$tableName}_card_date ON {$tableName}(card_id, price_date)");
                DB::statement("CREATE INDEX idx_{$tableName}_price_date ON {$tableName}(price_date)");

                $unionParts[] = "SELECT * FROM {$tableName} WHERE price_date BETWEEN '{$startDate}' AND '{$endDate}'";
            }
        }

        $unionAll = implode(" UNION ALL ", $unionParts);

        DB::statement("
            CREATE VIEW price_histories_view AS
            SELECT * FROM (
                {$unionAll}
            ) AS all_prices
        ");
    }

    public function down(): void
    {
        $currentYear = date('Y');
        $startYear = $currentYear - 2;
        $endYear = $currentYear + 1;

        DB::statement('DROP VIEW IF EXISTS price_histories_view');

        for ($year = $startYear; $year <= $endYear; $year++) {
            for ($month = 1; $month <= 12; $month++) {
                $tableName = sprintf('price_histories_%04d_%02d', $year, $month);
                Schema::dropIfExists($tableName);
            }
        }

        Schema::dropIfExists('price_histories');
    }
};
