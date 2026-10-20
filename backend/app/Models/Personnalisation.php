<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Personnalisation extends Model
{
    protected $fillable = ['entreprise_id', 'logo', 'couleur_principale', 'couleur_secondaire'];

    public function entreprise(): BelongsTo
    {
        return $this->belongsTo(Entreprise::class);
    }
}