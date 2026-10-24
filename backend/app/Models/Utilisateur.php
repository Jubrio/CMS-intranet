<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Utilisateur extends Authenticatable
{
    use HasApiTokens;

    protected $fillable = [
        'entreprise_id', 'role_id', 'departement_id', 'superieur_id',
        'nom', 'prenom', 'email', 'mot_de_passe', 'telephone', 'poste',
        'photo', 'date_embauche', 'statut_compte',
    ];

    protected $hidden = ['mot_de_passe'];

    protected $casts = ['mot_de_passe' => 'hashed', 'date_embauche' => 'date'];

    public function getAuthPasswordName(): string
    {
        return 'mot_de_passe';
    }

    public function entreprise(): BelongsTo
    {
        return $this->belongsTo(Entreprise::class);
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function departement(): BelongsTo
    {
        return $this->belongsTo(Departement::class);
    }
}
