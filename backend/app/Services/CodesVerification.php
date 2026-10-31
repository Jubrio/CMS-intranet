<?php

namespace App\Services;

use App\Mail\CodeVerificationMail;
use App\Models\CodeVerification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

// Codes à 6 chiffres envoyés par e-mail (inscription, mot de passe oublié).
// - le code vaut 10 minutes, 5 essais au plus ;
// - un nouvel envoi remplace le précédent, au plus 1 par minute et 5 par heure et par adresse ;
// - pour l'inscription, un code correct donne un jeton (30 min) que la création d'intranet consomme.
class CodesVerification
{
    public const INSCRIPTION = 'inscription';

    public const MOT_DE_PASSE = 'mot_de_passe';

    public const VALIDITE_CODE_MINUTES = 10;

    public const VALIDITE_JETON_MINUTES = 30;

    private const ESSAIS_MAX = 5;

    private const DELAI_ENTRE_ENVOIS_SECONDES = 60;

    private const ENVOIS_MAX_PAR_HEURE = 5;

    // Envoie un code. Retourne false si l'envoi est refusé (trop fréquent) ou a échoué ; l'appelant
    // répond de la même façon dans tous les cas pour ne rien révéler sur l'adresse.
    public function envoyer(string $email, string $objet): bool
    {
        $email = $this->normaliser($email);

        $recents = CodeVerification::where('email', $email)->where('objet', $objet)
            ->where('created_at', '>', now()->subHour())->orderByDesc('id')->get();
        if ($recents->count() >= self::ENVOIS_MAX_PAR_HEURE
            || ($recents->first() && $recents->first()->created_at->gt(now()->subSeconds(self::DELAI_ENTRE_ENVOIS_SECONDES)))) {
            return false;
        }

        // Les anciens codes encore valides sont invalidés
        CodeVerification::where('email', $email)->where('objet', $objet)->whereNull('utilise_le')
            ->update(['utilise_le' => now()]);

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        CodeVerification::create([
            'email' => $email,
            'objet' => $objet,
            'code_hash' => $this->hacher($email, $objet, $code),
            'expire_le' => now()->addMinutes(self::VALIDITE_CODE_MINUTES),
        ]);

        try {
            Mail::to($email)->send(new CodeVerificationMail($code, $objet, self::VALIDITE_CODE_MINUTES));
        } catch (\Throwable $e) {
            Log::error('Envoi du code de vérification impossible : '.$e->getMessage());

            return false;
        }

        return true;
    }

    // Vérifie un code. Retourne la ligne si le code est bon (sans la consommer), sinon null.
    public function verifier(string $email, string $objet, string $code): ?CodeVerification
    {
        $email = $this->normaliser($email);

        $ligne = CodeVerification::where('email', $email)->where('objet', $objet)
            ->whereNull('utilise_le')->whereNull('verifie_le')
            ->where('expire_le', '>', now())->orderByDesc('id')->first();
        if (! $ligne || $ligne->tentatives >= self::ESSAIS_MAX) {
            return null;
        }

        $ligne->increment('tentatives');
        if (! hash_equals($ligne->code_hash, $this->hacher($email, $objet, $code))) {
            return null;
        }

        return $ligne;
    }

    // Inscription : code correct -> jeton à renvoyer lors de la création de l'intranet
    public function confirmerInscription(string $email, string $code): ?string
    {
        $ligne = $this->verifier($email, self::INSCRIPTION, $code);
        if (! $ligne) {
            return null;
        }

        $jeton = Str::random(40);
        $ligne->update([
            'verifie_le' => now(),
            'jeton_hash' => hash('sha256', $jeton),
            'expire_le' => now()->addMinutes(self::VALIDITE_JETON_MINUTES),
        ]);

        return $jeton;
    }

    // Le jeton est-il valide pour cette adresse ? (sans le consommer)
    public function jetonValide(string $email, string $jeton): bool
    {
        return $this->ligneJeton($email, $jeton) !== null;
    }

    public function consommerJeton(string $email, string $jeton): void
    {
        $this->ligneJeton($email, $jeton)?->update(['utilise_le' => now()]);
    }

    // Mot de passe oublié : un code correct est consommé aussitôt
    public function consommerCode(string $email, string $objet, string $code): bool
    {
        $ligne = $this->verifier($email, $objet, $code);
        if (! $ligne) {
            return false;
        }
        $ligne->update(['utilise_le' => now()]);

        return true;
    }

    private function ligneJeton(string $email, string $jeton): ?CodeVerification
    {
        $email = $this->normaliser($email);
        $ligne = CodeVerification::where('email', $email)->where('objet', self::INSCRIPTION)
            ->whereNotNull('verifie_le')->whereNull('utilise_le')
            ->where('expire_le', '>', now())->orderByDesc('id')->first();

        return $ligne && $ligne->jeton_hash && hash_equals($ligne->jeton_hash, hash('sha256', $jeton)) ? $ligne : null;
    }

    private function normaliser(string $email): string
    {
        return mb_strtolower(trim($email));
    }

    // HMAC avec la clé de l'application : un code à 6 chiffres haché simplement serait trivial à retrouver
    private function hacher(string $email, string $objet, string $code): string
    {
        return hash_hmac('sha256', $email.'|'.$objet.'|'.trim($code), (string) config('app.key'));
    }
}
