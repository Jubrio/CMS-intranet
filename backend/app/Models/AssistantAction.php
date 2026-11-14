<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssistantAction extends Model
{
    public const EN_ATTENTE = 'en_attente';

    public const CONFIRMEE = 'confirmee';

    public const ANNULEE = 'annulee';

    public const EXECUTEE = 'executee';

    public const ECHEC = 'echec';

    protected $fillable = [
        'conversation_id', 'utilisateur_id', 'outil', 'parametres', 'statut',
        'resultat', 'erreur', 'confirmee_le', 'executee_le',
    ];

    protected $casts = [
        'parametres' => 'array',
        'resultat' => 'array',
        'confirmee_le' => 'datetime',
        'executee_le' => 'datetime',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(AssistantConversation::class, 'conversation_id');
    }

    public function utilisateur(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class);
    }
}
