<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Module extends Model
{
    protected $fillable = [
        'code_module', 'nom_module', 'description_module', 'module_obligatoire', 'actif_global', 'retire_le',
    ];

    protected $casts = [
        'module_obligatoire' => 'boolean',
        'actif_global' => 'boolean',
        'retire_le' => 'datetime',
    ];

    public function permissions(): HasMany
    {
        return $this->hasMany(Permission::class);
    }

    /** Modules encore au catalogue (non retirés). */
    public function scopeAuCatalogue(Builder $q): Builder
    {
        return $q->whereNull('retire_le');
    }

    /** Modules que l'on peut proposer à une entreprise : au catalogue et non désactivés globalement. */
    public function scopePropose(Builder $q): Builder
    {
        return $q->whereNull('retire_le')->where('actif_global', true);
    }

    public function estRetire(): bool
    {
        return $this->retire_le !== null;
    }
}
