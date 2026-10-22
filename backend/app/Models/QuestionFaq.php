<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuestionFaq extends Model
{
    protected $table = 'questions_faq';

    protected $fillable = ['entreprise_id', 'auteur_id', 'question', 'reponse', 'categorie'];

    public function auteur(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class, 'auteur_id');
    }
}