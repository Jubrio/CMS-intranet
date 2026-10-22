<?php

namespace App\Http\Requests;

use App\Services\AccesContenus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EnregistrerContenuRequest extends FormRequest
{
    public function authorize(): bool
    {
        return app(AccesContenus::class)->autorise($this->user(), $this->route('type'), 'publier');
    }
    
    protected function failedAuthorization()
    {
        abort(403, 'Action non autorisée.');
    }

    public function rules(): array
    {
        $entrepriseId = $this->user()->entreprise_id;
        $type = $this->route('type');
        $id = $this->route('id');
        $p = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'titre' => [$p, 'string', 'max:150'],
            'corps' => [$p, 'string'],
            'categorie' => 'nullable|string|max:50',
            'visibilite' => [$p, 'in:entreprise,departement'],
            'departement_id' => ['required_if:visibilite,departement', 'nullable',
                Rule::exists('departements', 'id')->where('entreprise_id', $entrepriseId)],
            'date_expiration' => $type === 'annonce' ? 'nullable|date|after_or_equal:today' : 'prohibited',
            'numero_note' => $type === 'note_service'
                ? [$p, 'string', 'max:20',
                    Rule::unique('contenus', 'numero_note')->where('entreprise_id', $entrepriseId)->ignore($id)]
                : 'prohibited',
        ];
    }
}
