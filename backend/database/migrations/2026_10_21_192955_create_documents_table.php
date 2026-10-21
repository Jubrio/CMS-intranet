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
        Schema::create('documents', function (Blueprint $table) {
    $table->id();
    $table->foreignId('entreprise_id')->constrained('entreprises')->cascadeOnDelete();
    $table->foreignId('auteur_id')->constrained('utilisateurs')->restrictOnDelete();
    $table->foreignId('departement_id')->nullable()->constrained('departements')->restrictOnDelete();
    $table->string('nom_document', 150);
    $table->string('fichier', 255);          
    $table->string('type_mime', 100);
    $table->unsignedInteger('taille_fichier'); 
    $table->string('categorie', 50);
    $table->string('visibilite', 15)->default('entreprise'); 
    $table->timestamps();

    $table->index(['entreprise_id', 'categorie']);
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
