<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EnregistrerEvenementRequest extends FormRequest
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
            'titre_evenement' => [$p, 'string', 'max:150'],
            'description_evenement' => 'nullable|string|max:5000',
            'date_debut' => [$p, 'date'],
            'date_fin' => $post ? ['required', 'date', 'after_or_equal:date_debut'] : ['sometimes', 'date'], // RG27
            'lieu' => 'nullable|string|max:100',
            'visibilite' => [$p, 'in:entreprise,departement'],
            'departement_id' => ['required_if:visibilite,departement', 'nullable',
                Rule::exists('departements', 'id')->where('entreprise_id', $this->user()->entreprise_id)],
        ];
    }
}
