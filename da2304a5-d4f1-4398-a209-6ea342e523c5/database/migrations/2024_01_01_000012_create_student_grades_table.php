<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_grades', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('enrollment_id')->unique();
            $table->decimal('total_score', 5, 2);
            $table->decimal('grade_point', 3, 2);
            $table->string('letter_grade', 2);
            $table->boolean('is_retake')->default(false);
            $table->timestamps();

            $table->foreign('enrollment_id')->references('id')->on('enrollments')->onDelete('cascade');
            $table->index('enrollment_id');
            $table->index('grade_point');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_grades');
    }
};
