<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('grades', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('enrollment_id');
            $table->unsignedBigInteger('component_id');
            $table->decimal('score', 5, 2)->nullable();
            $table->boolean('is_absent')->default(false);
            $table->unsignedBigInteger('graded_by')->nullable();
            $table->timestamp('graded_at')->nullable();
            $table->timestamps();

            $table->foreign('enrollment_id')->references('id')->on('enrollments')->onDelete('cascade');
            $table->foreign('component_id')->references('id')->on('grade_components')->onDelete('cascade');
            $table->foreign('graded_by')->references('id')->on('teachers')->onDelete('set null');
            $table->unique(['enrollment_id', 'component_id']);
            $table->index('enrollment_id');
            $table->index('component_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grades');
    }
};
