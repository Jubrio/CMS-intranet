<?php

use App\Http\Middleware\VerifierCompteActif;
use App\Http\Middleware\VerifierModule;
use App\Http\Middleware\VerifierPermission;
use App\Http\Middleware\VerifierSuperAdmin;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Derrière le proxy HTTPS de l'hébergeur : sans cela, les URL signées des fichiers sont générées en http
        $middleware->trustProxies(at: '*');

        $middleware->alias([
            'permission' => VerifierPermission::class,
            'module' => VerifierModule::class,
            'compte.actif' => VerifierCompteActif::class,
            'super.admin' => VerifierSuperAdmin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Les 404 de l'API ne révèlent ni le nom du modèle ni l'identifiant
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Ressource introuvable.'], 404);
            }
        });
    })->create();
