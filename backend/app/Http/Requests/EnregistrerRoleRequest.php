<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EnregistrerRoleRequest extends FormRequest
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
            'nom_role' => [$presence, 'string', 'max:100',
                Rule::notIn(['Super-administrateur']),
                Rule::unique('roles', 'nom_role')
                    ->where('entreprise_id', $entrepriseId)->ignore($id)],
            'permissions' => [$presence, 'array', 'min:1'],
            'permissions.*' => ['string', 'distinct',
                Rule::exists('permissions', 'code_permission')],
        ];
    }
}