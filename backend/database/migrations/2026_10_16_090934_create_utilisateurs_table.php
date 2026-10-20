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
    Schema::create('utilisateurs', function (Blueprint $table) {
        $table->id();
        $table->foreignId('entreprise_id')->nullable()->constrained('entreprises')->cascadeOnDelete();
        $table->foreignId('role_id')->constrained('roles')->restrictOnDelete();
        $table->foreignId('departement_id')->nullable()->constrained('departements')->nullOnDelete();
        $table->string('nom', 50);
        $table->string('prenom', 60);
        $table->string('email', 100)->unique();
        $table->string('mot_de_passe', 255);
        $table->string('telephone', 20)->nullable();
        $table->string('poste', 100)->nullable();
        $table->string('photo', 255)->nullable();
        $table->date('date_embauche')->nullable();
        $table->string('statut_compte', 10)->default('actif'); 
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('utilisateurs');
    }
};
