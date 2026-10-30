<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Http;

class CaptchaTurnstile implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $secret = config('services.turnstile.secret');
        if (! $secret) {
            return;
        }

        try {
            $reponse = Http::asForm()->timeout(5)->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
                'secret' => $secret,
                'response' => (string) $value,
                'remoteip' => request()->ip(),
            ]);
            $ok = $reponse->ok() && $reponse->json('success') === true;
        } catch (\Throwable) {
            $ok = false;
        }

        if (! $ok) {
            $fail('Vérification anti-robot échouée. Réessayez.');
        }
    }
}
