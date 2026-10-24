<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LectureNote extends Model
{
    protected $table = 'lectures_notes';

    public $timestamps = false;

    protected $fillable = ['entreprise_id', 'contenu_id', 'utilisateur_id', 'date_lecture'];

    protected $casts = ['date_lecture' => 'datetime'];

    public function utilisateur(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class, 'utilisateur_id');
    }
}
