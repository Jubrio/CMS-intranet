<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Module extends Model
{
    protected $fillable = ['code_module', 'nom_module', 'description_module', 'module_obligatoire'];

    protected $casts = ['module_obligatoire' => 'boolean'];

    public function permissions(): HasMany
    {
        return $this->hasMany(Permission::class);
    }
}
