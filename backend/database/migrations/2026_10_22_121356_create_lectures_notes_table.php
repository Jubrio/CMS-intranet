<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lectures_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entreprise_id')->constrained('entreprises')->cascadeOnDelete(); // RG05
            $table->foreignId('contenu_id')->constrained('contenus')->cascadeOnDelete();
            $table->foreignId('utilisateur_id')->constrained('utilisateurs')->restrictOnDelete();
            $table->timestamp('date_lecture');

            $table->unique(['contenu_id', 'utilisateur_id']); // une confirmation par employe et par note
            $table->index('entreprise_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lectures_notes');
    }
};