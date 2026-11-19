<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// Tout ce dont l'espace a besoin juste après la connexion, en une seule requête :
// profil, apparence de l'entreprise et menu. Remplace l'enchaînement /me -> /personnalisation + /menu,
// où chaque appel refaisait l'authentification et ses requêtes à la base.
class SessionController extends Controller
{
    public function __invoke(
        Request $request,
        AuthController $auth,
        PersonnalisationController $personnalisation,
        MenuController $menu,
    ): JsonResponse {
        $u = $request->user()->loadMissing(['role.permissions', 'entreprise.personnalisation']);

        // Comme avant : si l'apparence ou le menu échouent, la session reste utilisable sans eux
        try {
            $perso = $u->entreprise ? $personnalisation->donnees($u->entreprise) : null;
        } catch (\Throwable $e) {
            report($e);
            $perso = null;
        }

        try {
            $menuDonnees = $menu->index($request)->getData(true);
        } catch (\Throwable $e) {
            report($e);
            $menuDonnees = null;
        }

        return response()->json([
            'profil' => $auth->profil($u),
            'personnalisation' => $perso,
            'menu' => $menuDonnees,
        ]);
    }
}
