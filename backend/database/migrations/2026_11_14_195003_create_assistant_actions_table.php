<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assistant_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('assistant_conversations')->cascadeOnDelete();
            $table->foreignId('utilisateur_id')->constrained('utilisateurs')->cascadeOnDelete();
            $table->string('outil', 60);
            $table->json('parametres');
            $table->string('statut', 20)->default('en_attente'); // en_attente | confirmee | annulee | executee | echec
            $table->json('resultat')->nullable();
            $table->text('erreur')->nullable();
            $table->timestamp('confirmee_le')->nullable();
            $table->timestamp('executee_le')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assistant_actions');
    }
};
