<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cas « Gérer le catalogue de modules » : désactivation globale et retrait.
     * - actif_global = false : le module n'est plus proposé aux nouvelles entreprises ;
     *   celles qui l'utilisent déjà le conservent.
     * - retire_le renseigné : le module sort du catalogue et devient inutilisable,
     *   mais ses données et ses permissions restent en base.
     */
    public function up(): void
    {
        Schema::table('modules', function (Blueprint $table) {
            $table->boolean('actif_global')->default(true)->after('module_obligatoire');
            $table->timestamp('retire_le')->nullable()->after('actif_global');
        });
    }

    public function down(): void
    {
        Schema::table('modules', function (Blueprint $table) {
            $table->dropColumn(['actif_global', 'retire_le']);
        });
    }
};
