<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JournalOperation extends Model
{
    public $timestamps = false;

    protected $table = 'journal_operations';

    protected $fillable = [
        'utilisateur_id', 'utilisateur_libelle', 'action', 'cible_type', 'cible_id', 'cible_libelle', 'details',
    ];

    protected $casts = ['details' => 'array', 'created_at' => 'datetime'];
}
