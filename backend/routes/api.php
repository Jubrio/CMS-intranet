<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\IntranetController;
use App\Http\Controllers\Api\ModuleController;
use App\Http\Controllers\Api\ModuleEntrepriseController;
use App\Http\Controllers\Api\PersonnalisationController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\UtilisateurController;
use App\Http\Controllers\Api\DepartementController;
use App\Http\Controllers\Api\ContenuController;
use App\Http\Controllers\Api\AnnuaireController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\EvenementController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;


// Routes publiques
Route::get('/health', fn () => response()->json(['status' => 'ok']));
Route::get('/modules/catalogue', [ModuleController::class, 'catalogue']);
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/intranets', [IntranetController::class, 'creer'])->middleware('throttle:5,1');

// Routes protégées (jeton obligatoire)
Route::middleware(['auth:sanctum', 'compte.actif'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'moi']);

    // Modules (étape 22)
    Route::get('/modules', [ModuleEntrepriseController::class, 'index'])
        ->middleware('permission:personnalisation.modules');
    Route::put('/modules/{code}', [ModuleEntrepriseController::class, 'update'])
        ->middleware('permission:personnalisation.modules');

    Route::get('/personnalisation', [PersonnalisationController::class, 'show']);
    Route::put('/personnalisation', [PersonnalisationController::class, 'updateApparence'])
        ->middleware('permission:personnalisation.apparence');
    Route::post('/personnalisation/logo', [PersonnalisationController::class, 'updateLogo'])
        ->middleware('permission:personnalisation.apparence');
    Route::put('/entreprise', [PersonnalisationController::class, 'updateParametres'])
        ->middleware('permission:personnalisation.parametres');
            // Utilisateurs (étape 24)
    Route::middleware('permission:utilisateurs.gerer')->group(function () {
        Route::get('/utilisateurs', [UtilisateurController::class, 'index']);
        Route::post('/utilisateurs', [UtilisateurController::class, 'store']);
        Route::get('/utilisateurs/{id}', [UtilisateurController::class, 'show'])->whereNumber('id');
        Route::put('/utilisateurs/{id}', [UtilisateurController::class, 'update'])->whereNumber('id');
        Route::put('/utilisateurs/{id}/statut', [UtilisateurController::class, 'changerStatut'])->whereNumber('id');
    });
            // Départements (étape 25)
    Route::middleware('permission:utilisateurs.departements')->group(function () {
        Route::get('/departements', [DepartementController::class, 'index']);
        Route::post('/departements', [DepartementController::class, 'store']);
        Route::get('/departements/{id}', [DepartementController::class, 'show'])->whereNumber('id');
        Route::put('/departements/{id}', [DepartementController::class, 'update'])->whereNumber('id');
        Route::delete('/departements/{id}', [DepartementController::class, 'destroy'])->whereNumber('id');
    });
            // Rôles et permissions (étape 26)
    Route::get('/roles/assignables', [RoleController::class, 'assignables'])
        ->middleware('permission:utilisateurs.gerer');

    Route::middleware('permission:roles.gerer')->group(function () {
        Route::get('/permissions', [RoleController::class, 'permissions']);
        Route::get('/roles', [RoleController::class, 'index']);
        Route::post('/roles', [RoleController::class, 'store']);
        Route::get('/roles/{id}', [RoleController::class, 'show'])->whereNumber('id');
        Route::put('/roles/{id}', [RoleController::class, 'update'])->whereNumber('id');
        Route::delete('/roles/{id}', [RoleController::class, 'destroy'])->whereNumber('id');
    });
            // Contenus (étape 28)
    Route::get('/contenus/{type}', [ContenuController::class, 'index'])
        ->where('type', 'actualite|annonce|article|note_service');
    Route::get('/contenus/{type}/{id}', [ContenuController::class, 'show'])
        ->where('type', 'actualite|annonce|article|note_service')->whereNumber('id');
    Route::post('/contenus/{type}', [ContenuController::class, 'store'])
        ->where('type', 'actualite|annonce|article|note_service');

    Route::put('/contenus/{type}/{id}', [ContenuController::class, 'update'])
        ->where('type', 'actualite|annonce|article|note_service')->whereNumber('id');
    Route::post('/contenus/{type}/{id}/publier', [ContenuController::class, 'publier'])
        ->where('type', 'actualite|annonce|article|note_service')->whereNumber('id');
    Route::post('/contenus/{type}/{id}/archiver', [ContenuController::class, 'archiver'])
        ->where('type', 'actualite|annonce|article|note_service')->whereNumber('id');
    Route::delete('/contenus/{type}/{id}', [ContenuController::class, 'destroy'])
        ->where('type', 'actualite|annonce|article|note_service')->whereNumber('id');
            // Annuaire et organigramme (étape 30)
    Route::middleware(['module:annuaire', 'permission:annuaire.consulter'])->group(function () {
        Route::get('/annuaire', [AnnuaireController::class, 'index']);
        Route::get('/annuaire/{id}', [AnnuaireController::class, 'show'])->whereNumber('id');
        Route::get('/organigramme', [AnnuaireController::class, 'organigramme']);
    });
    Route::middleware(['module:annuaire', 'permission:annuaire.gerer'])->group(function () {
        Route::put('/annuaire/{id}', [AnnuaireController::class, 'modifier'])->whereNumber('id');
        Route::post('/annuaire/{id}/photo', [AnnuaireController::class, 'photo'])->whereNumber('id');
    });
        // Documents (étape 32)
    Route::middleware('module:documents')->group(function () {
        Route::middleware('permission:documents.consulter')->group(function () {
            Route::get('/documents', [DocumentController::class, 'index']);
            Route::get('/documents/categories', [DocumentController::class, 'categories']);
            Route::get('/documents/{id}', [DocumentController::class, 'show'])->whereNumber('id');
            Route::get('/documents/{id}/telecharger', [DocumentController::class, 'telecharger'])->whereNumber('id');
        });
        Route::middleware('permission:documents.gerer')->group(function () {
            Route::post('/documents', [DocumentController::class, 'store']);
            Route::put('/documents/{id}', [DocumentController::class, 'update'])->whereNumber('id');
            Route::delete('/documents/{id}', [DocumentController::class, 'destroy'])->whereNumber('id');
        });
    });
            // Calendrier et événements (étape 33)
    Route::middleware(['module:calendrier', 'module:evenements'])->group(function () {
        Route::middleware(['permission:calendrier.consulter', 'permission:evenements.consulter'])->group(function () {
            Route::get('/evenements', [EvenementController::class, 'index']);
            Route::get('/evenements/{id}', [EvenementController::class, 'show'])->whereNumber('id');
        });
        Route::middleware('permission:evenements.gerer')->group(function () {
            Route::post('/evenements', [EvenementController::class, 'store']);
            Route::put('/evenements/{id}', [EvenementController::class, 'update'])->whereNumber('id');
            Route::delete('/evenements/{id}', [EvenementController::class, 'destroy'])->whereNumber('id');
        });
    });
});