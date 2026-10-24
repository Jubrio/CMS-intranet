<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Image extends Model
{
    protected $table = 'images';

    protected $fillable = [
        'entreprise_id', 'contenu_id', 'auteur_id', 'nom_image', 'texte_alternatif',
        'fichier', 'type_mime', 'taille_fichier',
    ];

    public function contenu(): BelongsTo
    {
        return $this->belongsTo(Contenu::class, 'contenu_id');
    }
}
