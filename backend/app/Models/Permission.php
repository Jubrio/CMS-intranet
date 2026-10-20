<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Permission extends Model
{
    protected $fillable = ['module_id', 'code_permission', 'libelle_permission'];

    public function module(): BelongsTo
    {
        return $this->belongsTo(Module::class);
    }
}