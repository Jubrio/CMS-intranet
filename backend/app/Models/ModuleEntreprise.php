<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ModuleEntreprise extends Model
{
    protected $table = 'modules_entreprise';

    protected $fillable = ['entreprise_id', 'module_id', 'module_actif', 'date_activation'];

    protected $casts = ['module_actif' => 'boolean', 'date_activation' => 'datetime'];

    public function entreprise(): BelongsTo
    {
        return $this->belongsTo(Entreprise::class);
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(Module::class);
    }
}
