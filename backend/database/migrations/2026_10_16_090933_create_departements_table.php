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
    Schema::create('departements', function (Blueprint $table) {
        $table->id();
        $table->foreignId('entreprise_id')->constrained('entreprises')->cascadeOnDelete();
        $table->foreignId('departement_parent_id')->nullable()->constrained('departements')->nullOnDelete();
        $table->string('nom_departement', 100);
        $table->string('description_departement', 250)->nullable();
        $table->timestamps();
        $table->unique(['entreprise_id', 'nom_departement']);
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('departements');
    }
};
