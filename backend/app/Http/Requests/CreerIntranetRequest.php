<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

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
            'mot_de_passe' => ['required', 'string', 'min:8'],
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
