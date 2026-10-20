<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Module;
use Illuminate\Http\JsonResponse;

class ModuleController extends Controller
{
    public function catalogue(): JsonResponse
    {
        return response()->json(
            Module::orderByDesc('module_obligatoire')
                ->orderBy('nom_module')
                ->get(['code_module', 'nom_module', 'description_module', 'module_obligatoire'])
        );
    }
}