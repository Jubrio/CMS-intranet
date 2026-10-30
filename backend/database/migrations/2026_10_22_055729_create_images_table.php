<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entreprise_id')->constrained('entreprises')->cascadeOnDelete();
            $table->foreignId('contenu_id')->constrained('contenus')->cascadeOnDelete();
            $table->foreignId('auteur_id')->constrained('utilisateurs')->restrictOnDelete();
            $table->string('nom_image', 150);
            $table->string('texte_alternatif', 200)->nullable();
            $table->string('fichier', 255);
            $table->string('type_mime', 50);
            $table->unsignedInteger('taille_fichier');
            $table->timestamps();

            $table->index('contenu_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('images');
    }
};
