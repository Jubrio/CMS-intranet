<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Un enregistrement par événement (qui a fait quoi, sur quoi, pour qui)
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entreprise_id')->constrained('entreprises')->cascadeOnDelete(); // RG05
            $table->foreignId('acteur_id')->constrained('utilisateurs')->restrictOnDelete();
            // Null = toute l'entreprise ; sinon seuls les membres de ce département sont notifiés
            $table->foreignId('departement_id')->nullable()->constrained('departements')->cascadeOnDelete();
            $table->string('action', 20);       // publie / cree / depose
            $table->string('objet_type', 20);   // actualite / annonce / article / note_service / evenement / document
            $table->unsignedBigInteger('objet_id');
            $table->string('titre', 200);       // titre au moment de l'action, pour l'affichage
            $table->timestamps();

            $table->index(['objet_type', 'objet_id']);
            $table->index('entreprise_id');
        });

        // Un enregistrement par destinataire : c'est lui qui porte le statut lu / non lu
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
