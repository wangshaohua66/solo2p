<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('classrooms', function (Blueprint $table) {
            $table->id();
            $table->string('building', 50);
            $table->string('room_number', 20);
            $table->integer('capacity');
            $table->enum('type', ['lecture', 'lab', 'computer', 'multimedia']);
            $table->tinyInteger('status')->default(1);
            $table->timestamps();

            $table->unique(['building', 'room_number']);
            $table->index('capacity');
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classrooms');
    }
};
