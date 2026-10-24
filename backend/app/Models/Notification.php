<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Notification extends Model
{
    protected $table = 'notifications';

    protected $fillable = [
        'entreprise_id', 'acteur_id', 'departement_id', 'action', 'objet_type', 'objet_id', 'titre',
    ];

    public function acteur(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class, 'acteur_id');
    }

    public function departement(): BelongsTo
    {
        return $this->belongsTo(Departement::class);
    }

    public function destinataires(): HasMany
    {
        return $this->hasMany(NotificationUtilisateur::class);
    }
}
