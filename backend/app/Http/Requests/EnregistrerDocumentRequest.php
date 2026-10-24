<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EnregistrerDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $p = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'fichier' => $this->isMethod('POST')
    ? ['required', 'file', 'max:10240',
        'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,txt,jpg,jpeg,png',
        'extensions:pdf,doc,docx,xls,xlsx,ppt,pptx,txt,jpg,jpeg,png']
    : 'prohibited',
            'nom_document' => ['sometimes', 'string', 'max:150'],
            'categorie' => [$p, 'string', 'max:50'],
            'visibilite' => [$p, 'in:entreprise,departement'],
            'departement_id' => ['required_if:visibilite,departement', 'nullable',
                Rule::exists('departements', 'id')->where('entreprise_id', $this->user()->entreprise_id)],
        ];
    }
}
