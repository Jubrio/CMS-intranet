<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Formulaire extends Model
{
    protected $fillable = [
        'entreprise_id', 'auteur_id', 'departement_id', 'titre_formulaire', 'champs',
        'visibilite', 'reponse_unique', 'date_limite', 'statut_formulaire',
    ];

    protected $casts = [
        'champs' => 'array',
        'reponse_unique' => 'boolean',
        'date_limite' => 'date',
    ];

    public function auteur(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class, 'auteur_id');
    }

    public function reponses(): HasMany
    {
        return $this->hasMany(Reponse::class);
    }

    public function estOuvert(): bool
    {
        return $this->statut_formulaire === 'publie'
            && ($this->date_limite === null || ! $this->date_limite->lt(today()));
    }
}
