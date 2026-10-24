<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EnregistrerFormulaireRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $post = $this->isMethod('POST');
        $p = $post ? 'required' : 'sometimes';

        return [
            'titre_formulaire' => [$p, 'string', 'max:150'],
            'champs' => [$p, 'array', 'min:1', 'max:30'],
            'champs.*.nom' => ['required', 'string', 'max:50', 'regex:/^[a-z][a-z0-9_]*$/', 'distinct'],
            'champs.*.libelle' => ['required', 'string', 'max:150'],
            'champs.*.type' => ['required', 'in:texte,texte_long,nombre,date,choix_unique,choix_multiple'],
            'champs.*.obligatoire' => ['sometimes', 'boolean'],
            'champs.*.options' => ['required_if:champs.*.type,choix_unique,choix_multiple', 'array', 'min:2'],
            'champs.*.options.*' => ['string', 'max:100', 'distinct'],
            'visibilite' => [$p, 'in:entreprise,departement'],
            'departement_id' => ['required_if:visibilite,departement', 'nullable',
                Rule::exists('departements', 'id')->where('entreprise_id', $this->user()->entreprise_id)],
            'reponse_unique' => ['sometimes', 'boolean'],
            'date_limite' => ['nullable', 'date', 'after_or_equal:today'],
            'statut_formulaire' => $post ? ['sometimes', 'in:brouillon,publie'] : ['prohibited'],
        ];
    }
}
