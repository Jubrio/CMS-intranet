<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Entreprise extends Model
{
    protected $fillable = ['nom_entreprise', 'slug', 'email_contact', 'statut_entreprise'];

    public function utilisateurs(): HasMany { return $this->hasMany(Utilisateur::class); }
    public function roles(): HasMany { return $this->hasMany(Role::class); }
    public function departements(): HasMany { return $this->hasMany(Departement::class); }
    public function modules(): HasMany { return $this->hasMany(ModuleEntreprise::class); }
    public function personnalisation(): HasOne { return $this->hasOne(Personnalisation::class); }
}