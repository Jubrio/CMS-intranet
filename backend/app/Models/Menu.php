<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class Menu extends Model
{
    protected $fillable = [
        'entreprise_id', 'type_menu', 'module_id', 'libelle_menu', 'url_menu',
        'ordre_menu', 'visible', 'roles_limites',
    ];

    protected $casts = [
        'visible' => 'boolean',
        'roles_limites' => 'boolean',
    ];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'menu_role', 'menu_id', 'role_id');
    }

    public static function modulesActifs(?int $entrepriseId): Collection
    {
        return DB::table('modules_entreprise')
            ->join('modules', 'modules.id', '=', 'modules_entreprise.module_id')
            ->where('modules_entreprise.entreprise_id', $entrepriseId)
            ->where('modules_entreprise.module_actif', true)
            ->orderBy('modules.id')
            ->get(['modules.id', 'modules.code_module', 'modules.nom_module']);
    }
}
