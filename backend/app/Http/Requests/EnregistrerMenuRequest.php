<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EnregistrerMenuRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $communes = [
            'ordre_menu' => ['nullable', 'integer', 'between:0,9999'],
            'visible' => ['sometimes', 'boolean'],
            'roles' => ['nullable', 'array', 'min:1'],
            'roles.*' => ['integer', 'distinct',
                Rule::exists('roles', 'id')->where('entreprise_id', $this->user()->entreprise_id)],
        ];

        if ($this->route('code') !== null) {
            return $communes + ['libelle_menu' => ['nullable', 'string', 'max:50']];
        }

        $p = $this->isMethod('POST') ? 'required' : 'sometimes';

        return $communes + [
            'libelle_menu' => [$p, 'string', 'max:50'],
            // https://... ou chemin interne /... ; jamais http:, javascript:, data:, //hote ni /\hote
            'url_menu' => [$p, 'string', 'max:500', 'regex:#^(https://[^\s\\\\]+|/(?![/\\\\])[^\s\\\\]*)$#'],
        ];
    }
}