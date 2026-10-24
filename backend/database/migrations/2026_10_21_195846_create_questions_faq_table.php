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
        Schema::create('questions_faq', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entreprise_id')->constrained('entreprises')->cascadeOnDelete();
            $table->foreignId('auteur_id')->constrained('utilisateurs')->restrictOnDelete();
            $table->string('question', 250);
            $table->text('reponse');
            $table->string('categorie', 50);
            $table->timestamps();

            $table->index(['entreprise_id', 'categorie']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('questions_faq');
    }
};
