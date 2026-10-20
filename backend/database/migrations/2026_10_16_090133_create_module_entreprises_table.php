<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
{
    Schema::create('modules_entreprise', function (Blueprint $table) {
        $table->id();
        $table->foreignId('entreprise_id')->constrained('entreprises')->cascadeOnDelete();
        $table->foreignId('module_id')->constrained('modules')->cascadeOnDelete();
        $table->boolean('module_actif')->default(true);
        $table->timestamp('date_activation')->nullable();
        $table->timestamps();
        $table->unique(['entreprise_id', 'module_id']);
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('module_entreprises');
    }
};
