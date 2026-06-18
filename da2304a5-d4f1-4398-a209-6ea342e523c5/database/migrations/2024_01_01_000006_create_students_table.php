<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('students', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('major_id');
            $table->string('name', 50);
            $table->string('student_no', 20)->unique();
            $table->enum('gender', ['male', 'female']);
            $table->year('enrollment_year');
            $table->string('class_name', 20)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('email', 100)->unique()->nullable();
            $table->enum('status', ['active', 'suspended', 'withdrawn', 'graduated'])->default('active');
            $table->timestamps();

            $table->foreign('major_id')->references('id')->on('majors')->onDelete('restrict');
            $table->index('major_id');
            $table->index('student_no');
            $table->index('status');
            $table->index('enrollment_year');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('students');
    }
};
