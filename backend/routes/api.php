<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\IntranetController;
use App\Http\Controllers\Api\ModuleController;
use App\Http\Controllers\Api\ModuleEntrepriseController;
use App\Http\Controllers\Api\PersonnalisationController;
use App\Http\Controllers\Api\UtilisateurController;
use App\Http\Controllers\Api\DepartementController;
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
});