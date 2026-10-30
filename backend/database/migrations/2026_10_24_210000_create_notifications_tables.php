<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entreprise_id')->constrained('entreprises')->cascadeOnDelete();
            $table->foreignId('acteur_id')->constrained('utilisateurs')->restrictOnDelete();
            $table->foreignId('departement_id')->nullable()->constrained('departements')->cascadeOnDelete();
            $table->string('action', 20);
            $table->string('objet_type', 20);
            $table->unsignedBigInteger('objet_id');
            $table->string('titre', 200);
            $table->timestamps();

            $table->index(['objet_type', 'objet_id']);
            $table->index('entreprise_id');
        });

        Schema::create('notification_utilisateurs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('notification_id')->constrained('notifications')->cascadeOnDelete();
            $table->foreignId('utilisateur_id')->constrained('utilisateurs')->cascadeOnDelete();
            $table->timestamp('lu_at')->nullable();

            $table->unique(['notification_id', 'utilisateur_id']);
            $table->index(['utilisateur_id', 'lu_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_utilisateurs');
        Schema::dropIfExists('notifications');
    }
};
