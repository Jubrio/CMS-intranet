<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EnregistrerPageRequest extends FormRequest
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
            'titre' => [$p, 'string', 'max:150'],
            'corps' => [$p, 'string', 'max:100000'],
            'visibilite' => [$p, 'in:entreprise,departement'],
            'departement_id' => ['required_if:visibilite,departement', 'nullable',
                Rule::exists('departements', 'id')->where('entreprise_id', $this->user()->entreprise_id)],
            'emplacement_menu' => ['nullable', 'string', 'max:50'],
            'statut_contenu' => $post ? ['sometimes', 'in:brouillon,publie'] : ['prohibited'],
        ];
    }
}