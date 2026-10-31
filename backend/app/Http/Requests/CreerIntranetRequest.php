<?php

namespace App\Http\Requests;

use App\Rules\CaptchaTurnstile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class CreerIntranetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nom_entreprise' => ['required', 'string', 'max:100'],
            'nom' => ['required', 'string', 'max:50'],
            'prenom' => ['required', 'string', 'max:60'],
            // L'unicité de l'e-mail est contrôlée par IntranetController, après la vérification de l'adresse
            'email' => ['required', 'email', 'max:100'],
            'jeton_verification' => ['required', 'string', 'max:100'],
            'mot_de_passe' => ['required', 'string', 'max:72', Password::default()],
            'turnstile_token' => [Rule::requiredIf(fn () => filled(config('services.turnstile.secret'))),
                'nullable', 'string', 'max:2048', new CaptchaTurnstile],
            'modules' => ['nullable', 'array'],
            'modules.*' => ['string', 'exists:modules,code_module'],
        ];
    }

    public function messages(): array
    {
        return [
            'modules.*.exists' => 'Module inconnu : :input.',
        ];
    }
}
