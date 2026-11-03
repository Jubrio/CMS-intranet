<?php

namespace App\Providers;

use App\Mail\BrevoTransport;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Transport e-mail « brevo » (API HTTPS), pour les hébergeurs qui bloquent le SMTP
        Mail::extend('brevo', fn (array $config) => new BrevoTransport((string) ($config['key'] ?? '')));

        // Déconnexion automatique après inactivité : la dernière utilisation du jeton (last_used_at,
        // sinon sa création) ne doit pas remonter à plus de N minutes. Sanctum appelle ce contrôle
        // avant de mettre à jour last_used_at, donc la fenêtre glisse à chaque requête authentifiée.
        Sanctum::authenticateAccessTokensUsing(function ($jeton, bool $valide) {
            $minutes = (int) config('sanctum.inactivite', 0);
            if (! $valide || $minutes <= 0) {
                return $valide;
            }
            $derniere = $jeton->last_used_at ?? $jeton->created_at;
            if ($derniere && $derniere->lt(now()->subMinutes($minutes))) {
                $jeton->delete();

                return false;
            }

            return true;
        });

        // Règle unique des mots de passe : 10 caractères, lettres et chiffres ; en production,
        // refus des mots de passe présents dans des fuites connues (service externe, donc pas en test).
        Password::defaults(fn () => Password::min(10)->letters()->numbers()
            ->when(app()->isProduction(), fn (Password $regle) => $regle->uncompromised()));
    }
}
