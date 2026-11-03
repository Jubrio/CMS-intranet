<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Journal des opérations de la plateforme (cas « Gérer les entreprises ») :
     * qui a fait quoi, sur quelle entreprise. Aucune clé étrangère vers l'entreprise
     * ni vers l'utilisateur : la trace doit survivre à leur suppression.
     */
    public function up(): void
    {
        Schema::create('journal_operations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('utilisateur_id')->nullable();
            $table->string('utilisateur_libelle', 150)->nullable();
            $table->string('action', 40);
            $table->string('cible_type', 40);
            $table->unsignedBigInteger('cible_id')->nullable();
            $table->string('cible_libelle', 150)->nullable();
            $table->json('details')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['cible_type', 'cible_id']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('journal_operations');
    }
};
