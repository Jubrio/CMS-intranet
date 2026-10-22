<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reponse extends Model
{
    protected $table = 'reponses';

    protected $fillable = ['formulaire_id', 'entreprise_id', 'utilisateur_id', 'valeurs'];

    protected $casts = ['valeurs' => 'array'];

    public function utilisateur(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class, 'utilisateur_id');
    }
}