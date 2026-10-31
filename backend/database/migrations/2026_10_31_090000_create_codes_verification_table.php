<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Codes à 6 chiffres envoyés par e-mail : vérification avant création d'intranet,
        // et réinitialisation du mot de passe. Le code et le jeton ne sont jamais stockés en clair.
        Schema::create('codes_verification', function (Blueprint $table) {
            $table->id();
            $table->string('email', 255);
            $table->string('objet', 20); // inscription | mot_de_passe
            $table->string('code_hash', 64);
            $table->string('jeton_hash', 64)->nullable();
            $table->unsignedTinyInteger('tentatives')->default(0);
            $table->timestamp('expire_le');
            $table->timestamp('verifie_le')->nullable();
            $table->timestamp('utilise_le')->nullable();
            $table->timestamps();

            $table->index(['email', 'objet']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('codes_verification');
    }
};
