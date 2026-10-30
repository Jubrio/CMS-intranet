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
        Schema::create('contenus', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entreprise_id')->constrained('entreprises')->cascadeOnDelete();
            $table->foreignId('auteur_id')->constrained('utilisateurs')->restrictOnDelete();
            $table->foreignId('departement_id')->nullable()->constrained('departements')->restrictOnDelete();
            $table->string('type_contenu', 15);
            $table->string('titre', 150);
            $table->text('corps');
            $table->string('statut_contenu', 10)->default('brouillon');
            $table->string('visibilite', 15)->default('entreprise');
            $table->timestamp('date_publication')->nullable();
            $table->string('categorie', 50)->nullable();
            $table->string('emplacement_menu', 50)->nullable();
            $table->date('date_expiration')->nullable();
            $table->string('numero_note', 20)->nullable();
            $table->timestamps();

            $table->unique(['entreprise_id', 'numero_note']);
            $table->index(['entreprise_id', 'type_contenu', 'statut_contenu']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('contenus');
    }
};
