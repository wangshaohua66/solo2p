<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('classroom_occupancies', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('classroom_id');
            $table->string('semester', 20);
            $table->tinyInteger('day_of_week');
            $table->tinyInteger('start_period');
            $table->tinyInteger('end_period');
            $table->enum('occupant_type', ['schedule', 'exam']);
            $table->unsignedBigInteger('occupant_id')->nullable();
            $table->string('weeks', 50)->nullable();
            $table->timestamps();

            $table->foreign('classroom_id')->references('id')->on('classrooms')->onDelete('cascade');
            $table->index('classroom_id');
            $table->index('semester');
            $table->index('day_of_week');
            $table->index('start_period');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classroom_occupancies');
    }
};
