<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('majors', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('college_id');
            $table->string('name', 100);
            $table->string('code', 20)->unique();
            $table->enum('degree_level', ['bachelor', 'master', 'phd']);
            $table->tinyInteger('duration_years');
            $table->timestamps();

            $table->foreign('college_id')->references('id')->on('colleges')->onDelete('restrict');
            $table->index('college_id');
            $table->unique(['college_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('majors');
    }
};
