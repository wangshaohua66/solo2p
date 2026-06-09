<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meta_snapshots', function (Blueprint $table) {
            $table->id();
            $table->string('format');
            $table->string('source')->nullable();
            $table->date('snapshot_date')->index();
            $table->integer('total_decks')->default(0);
            $table->json('meta_data');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['format', 'snapshot_date']);
        });

        Schema::create('meta_archetypes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meta_snapshot_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->decimal('percentage', 5, 2)->default(0);
            $table->decimal('win_rate', 5, 2)->nullable();
            $table->integer('sample_size')->default(0);
            $table->json('color_identity')->nullable();
            $table->timestamps();

            $table->index(['meta_snapshot_id', 'percentage']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meta_archetypes');
        Schema::dropIfExists('meta_snapshots');
    }
};
