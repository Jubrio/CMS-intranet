<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreerIntranetRequest;
use App\Services\CreationIntranetService;
use Illuminate\Http\JsonResponse;

class IntranetController extends Controller
{
    public function creer(CreerIntranetRequest $request, CreationIntranetService $service): JsonResponse
    {
        [$entreprise, $admin, $modules] = $service->creer($request->validated());

        return response()->json([
            'message' => 'Intranet créé.',
            'entreprise' => [
                'nom' => $entreprise->nom_entreprise,
                'slug' => $entreprise->slug,
            ],
            'modules_actifs' => $modules,
            'token' => $admin->createToken('intranet')->plainTextToken,
        ], 201);
    }
}