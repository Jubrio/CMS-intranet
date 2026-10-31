<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreerIntranetRequest;
use App\Models\Utilisateur;
use App\Services\CodesVerification;
use App\Services\CreationIntranetService;
use Illuminate\Http\JsonResponse;

class IntranetController extends Controller
{
    public function creer(CreerIntranetRequest $request, CreationIntranetService $service, CodesVerification $codes): JsonResponse
    {
        $donnees = $request->validated();

        // L'adresse doit avoir été confirmée par le code reçu par e-mail
        if (! $codes->jetonValide($donnees['email'], $donnees['jeton_verification'])) {
            return response()->json([
                'message' => 'Adresse e-mail non vérifiée ou vérification expirée.',
                'errors' => ['jeton_verification' => ['Adresse e-mail non vérifiée ou vérification expirée.']],
            ], 422);
        }
        // Seul le propriétaire de l'adresse (qui vient de la prouver) apprend qu'elle est déjà prise
        if (Utilisateur::where('email', $donnees['email'])->exists()) {
            return response()->json([
                'message' => 'Cette adresse e-mail est déjà utilisée.',
                'errors' => ['email' => ['Cette adresse e-mail est déjà utilisée.']],
            ], 422);
        }

        [$entreprise, $admin, $modules] = $service->creer($donnees);
        $codes->consommerJeton($donnees['email'], $donnees['jeton_verification']);

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
