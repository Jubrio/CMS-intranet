<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Departement extends Model
{
    protected $fillable = [
        'entreprise_id', 'departement_parent_id', 'nom_departement',
        'description_departement', 'responsable_id',
    ];

    public function entreprise(): BelongsTo
    {
        return $this->belongsTo(Entreprise::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Departement::class, 'departement_parent_id');
    }

    public function enfants(): HasMany
    {
        return $this->hasMany(Departement::class, 'departement_parent_id');
    }

    public function utilisateurs(): HasMany
    {
        return $this->hasMany(Utilisateur::class, 'departement_id');
    }

    public function responsable(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class, 'responsable_id');
    }
}