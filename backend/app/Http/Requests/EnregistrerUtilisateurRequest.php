<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class EnregistrerUtilisateurRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $entrepriseId = $this->user()->entreprise_id;
        $id = $this->route('id');
        $presence = $this->isMethod('POST') ? 'required' : 'sometimes';

        $superieur = ['nullable', 'integer',
            Rule::exists('utilisateurs', 'id')->where('entreprise_id', $entrepriseId)];
        if ($id) {
            $superieur[] = Rule::notIn([$id]);
        }

        return [
            'nom' => [$presence, 'string', 'max:100'],
            'prenom' => [$presence, 'string', 'max:100'],
            'email' => [$presence, 'email', 'max:255',
                Rule::unique('utilisateurs', 'email')->ignore($id)],
            'mot_de_passe' => [$presence, 'string', 'max:72', Password::min(10)->letters()->numbers()->uncompromised()],
            'role_id' => [$presence, 'integer',
                Rule::exists('roles', 'id')->where('entreprise_id', $entrepriseId)],
            'departement_id' => ['nullable', 'integer',
                Rule::exists('departements', 'id')->where('entreprise_id', $entrepriseId)],
            'superieur_id' => $superieur,
            'telephone' => ['nullable', 'string', 'max:30'],
            'poste' => ['nullable', 'string', 'max:100'],
            'date_embauche' => ['nullable', 'date'],
        ];
    }
}
