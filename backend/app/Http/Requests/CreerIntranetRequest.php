<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use App\Rules\CaptchaTurnstile;
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
            'email' => ['required', 'email', 'max:100', 'unique:utilisateurs,email'], // RG7
            'mot_de_passe' => ['required', 'string', 'max:72', Password::min(10)->letters()->numbers()->uncompromised()],
            'turnstile_token' => [Rule::requiredIf(fn () => filled(config('services.turnstile.secret'))),
                'nullable', 'string', 'max:2048', new CaptchaTurnstile],
            'modules' => ['nullable', 'array'],
            'modules.*' => ['string', 'exists:modules,code_module'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'Cette adresse e-mail est déjà utilisée.',
            'modules.*.exists' => 'Module inconnu : :input.',
        ];
    }
}
