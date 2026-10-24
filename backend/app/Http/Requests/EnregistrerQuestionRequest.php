<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class EnregistrerQuestionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $p = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'question' => [$p, 'string', 'max:250'],
            'reponse' => [$p, 'string'],
            'categorie' => [$p, 'string', 'max:50'],
        ];
    }
}
