<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('formulaires', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entreprise_id')->constrained('entreprises')->cascadeOnDelete();
            $table->foreignId('auteur_id')->constrained('utilisateurs')->restrictOnDelete();
            $table->foreignId('departement_id')->nullable()->constrained('departements')->restrictOnDelete();
            $table->string('titre_formulaire', 150);
            $table->jsonb('champs');
            $table->string('visibilite', 15)->default('entreprise');
            $table->boolean('reponse_unique')->default(false);
            $table->date('date_limite')->nullable();
            $table->string('statut_formulaire', 15)->default('publie');
            $table->timestamps();
            $table->index(['entreprise_id', 'statut_formulaire']);
        });

        Schema::create('reponses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('formulaire_id')->constrained('formulaires')->cascadeOnDelete();
            $table->foreignId('entreprise_id')->constrained('entreprises')->cascadeOnDelete();
            $table->foreignId('utilisateur_id')->constrained('utilisateurs')->restrictOnDelete();
            $table->jsonb('valeurs');
            $table->timestamps();

            $table->index(['formulaire_id', 'utilisateur_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reponses');
        Schema::dropIfExists('formulaires');
    }
};
