<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teachers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('college_id');
            $table->string('name', 50);
            $table->string('employee_no', 20)->unique();
            $table->enum('gender', ['male', 'female']);
            $table->enum('title', ['assistant', 'lecturer', 'associate_professor', 'professor']);
            $table->string('phone', 20)->nullable();
            $table->string('email', 100)->unique();
            $table->enum('status', ['active', 'inactive', 'retired'])->default('active');
            $table->timestamps();

            $table->foreign('college_id')->references('id')->on('colleges')->onDelete('restrict');
            $table->index('college_id');
            $table->index('employee_no');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teachers');
    }
};
