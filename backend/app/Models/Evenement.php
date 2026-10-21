<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Evenement extends Model
{
    protected $fillable = [
        'entreprise_id', 'auteur_id', 'departement_id', 'titre_evenement',
        'description_evenement', 'date_debut', 'date_fin', 'lieu', 'visibilite',
    ];

    protected $casts = [
        'date_debut' => 'datetime',
        'date_fin' => 'datetime',
    ];

    public function auteur(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class, 'auteur_id');
    }
}