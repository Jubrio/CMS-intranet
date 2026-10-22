<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('menus', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entreprise_id')->constrained('entreprises')->cascadeOnDelete();
            $table->string('type_menu', 10);                       
            $table->foreignId('module_id')->nullable()->constrained('modules')->cascadeOnDelete();
            $table->string('libelle_menu', 50)->nullable();         
            $table->string('url_menu', 500)->nullable();         
            $table->unsignedSmallInteger('ordre_menu')->nullable(); 
            $table->boolean('visible')->default(true);
            $table->boolean('roles_limites')->default(false);        
            $table->timestamps();

            $table->unique(['entreprise_id', 'module_id']);          
            $table->index(['entreprise_id', 'type_menu']);
        });

        Schema::create('menu_role', function (Blueprint $table) {
            $table->foreignId('menu_id')->constrained('menus')->cascadeOnDelete();
            $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
            $table->primary(['menu_id', 'role_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('menu_role');
        Schema::dropIfExists('menus');
    }
};