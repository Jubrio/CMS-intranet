<?php

namespace App\Providers;

use App\Mail\BrevoTransport;
use Illuminate\Support\Facades\Mail;
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

        // Règle unique des mots de passe : 10 caractères, lettres et chiffres ; en production,
        // refus des mots de passe présents dans des fuites connues (service externe, donc pas en test).
        Password::defaults(fn () => Password::min(10)->letters()->numbers()
            ->when(app()->isProduction(), fn (Password $regle) => $regle->uncompromised()));
    }
}
