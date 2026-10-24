<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EnregistrerDepartementRequest extends FormRequest
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

        return [
            'nom_departement' => [$presence, 'string', 'max:150',
                Rule::unique('departements', 'nom_departement')
                    ->where('entreprise_id', $entrepriseId)->ignore($id)],
            'description_departement' => ['nullable', 'string', 'max:1000'],
            'departement_parent_id' => ['nullable', 'integer',
                Rule::exists('departements', 'id')->where('entreprise_id', $entrepriseId)], // RG17
            'responsable_id' => ['nullable', 'integer',
                Rule::exists('utilisateurs', 'id')->where('entreprise_id', $entrepriseId)], // RG18
        ];
    }
}
