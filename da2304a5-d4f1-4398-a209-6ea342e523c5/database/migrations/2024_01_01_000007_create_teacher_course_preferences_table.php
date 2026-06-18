<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teacher_course_preferences', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('teacher_id');
            $table->unsignedBigInteger('course_id');
            $table->string('semester', 20);
            $table->tinyInteger('preferred_day');
            $table->tinyInteger('preferred_period');
            $table->enum('preferred_classroom_type', ['lecture', 'lab', 'computer', 'multimedia'])->nullable();
            $table->tinyInteger('priority')->default(0);
            $table->timestamps();

            $table->foreign('teacher_id')->references('id')->on('teachers')->onDelete('cascade');
            $table->foreign('course_id')->references('id')->on('courses')->onDelete('cascade');
            $table->unique(['teacher_id', 'course_id', 'semester', 'preferred_day', 'preferred_period']);
            $table->index('teacher_id');
            $table->index('semester');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teacher_course_preferences');
    }
};
