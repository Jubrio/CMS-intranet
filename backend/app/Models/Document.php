<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Document extends Model
{
    protected $fillable = [
        'entreprise_id', 'auteur_id', 'departement_id', 'nom_document', 'fichier',
        'type_mime', 'taille_fichier', 'categorie', 'visibilite',
    ];

    public function auteur(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class, 'auteur_id');
    }
}
