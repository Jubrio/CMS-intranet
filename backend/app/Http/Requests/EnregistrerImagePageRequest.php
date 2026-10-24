<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class EnregistrerImagePageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'image' => ['required', 'file', 'image', 'max:5120',
                'mimes:jpg,jpeg,png,webp', 'extensions:jpg,jpeg,png,webp'],
            'texte_alternatif' => ['nullable', 'string', 'max:200'],
        ];
    }
}
