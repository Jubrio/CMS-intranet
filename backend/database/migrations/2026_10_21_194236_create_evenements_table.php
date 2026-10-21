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
        Schema::create('evenements', function (Blueprint $table) {
    $table->id();
    $table->foreignId('entreprise_id')->constrained('entreprises')->cascadeOnDelete();
    $table->foreignId('auteur_id')->constrained('utilisateurs')->restrictOnDelete();
    $table->foreignId('departement_id')->nullable()->constrained('departements')->restrictOnDelete();
    $table->string('titre_evenement', 150);
    $table->text('description_evenement')->nullable();
    $table->dateTime('date_debut');
    $table->dateTime('date_fin');           // RG27 : >= date_debut
    $table->string('lieu', 100)->nullable();
    $table->string('visibilite', 15)->default('entreprise'); // entreprise / departement
    $table->timestamps();

    $table->index(['entreprise_id', 'date_debut']);
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('evenements');
    }
};
