<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('college_id');
            $table->unsignedBigInteger('major_id')->nullable();
            $table->string('code', 20)->unique();
            $table->string('name', 100);
            $table->decimal('credits', 3, 1);
            $table->integer('hours');
            $table->enum('type', ['required', 'elective', 'general']);
            $table->string('category', 50)->nullable();
            $table->text('description')->nullable();
            $table->tinyInteger('status')->default(1);
            $table->timestamps();

            $table->foreign('college_id')->references('id')->on('colleges')->onDelete('restrict');
            $table->foreign('major_id')->references('id')->on('majors')->onDelete('set null');
            $table->index('college_id');
            $table->index('major_id');
            $table->index('code');
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courses');
    }
};
