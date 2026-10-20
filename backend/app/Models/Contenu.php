<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Contenu extends Model
{
    public const TYPES = ['page', 'actualite', 'annonce', 'article', 'note_service'];
    public const MODULES = ['page' => 'pages', 'actualite' => 'actualites', 'annonce' => 'annonces','article' => 'articles', 'note_service' => 'notes_service',];

    protected $fillable = [
        'entreprise_id', 'auteur_id', 'departement_id', 'type_contenu', 'titre', 'corps',
        'statut_contenu', 'visibilite', 'date_publication', 'categorie',
        'emplacement_menu', 'date_expiration', 'numero_note',
    ];

    protected $casts = [
        'date_publication' => 'datetime',
        'date_expiration' => 'date',
    ];

    public function auteur(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class, 'auteur_id');
    }

    public function departement(): BelongsTo
    {
        return $this->belongsTo(Departement::class);
    }
}