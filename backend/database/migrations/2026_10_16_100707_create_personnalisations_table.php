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
        Schema::create('personnalisations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entreprise_id')->unique()->constrained('entreprises')->cascadeOnDelete();
            $table->string('logo', 255)->nullable();
            $table->string('couleur_principale', 7)->default('#1D4ED8');
            $table->string('couleur_secondaire', 7)->default('#475569');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('personnalisations');
    }
};
