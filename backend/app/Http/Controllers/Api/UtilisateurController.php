<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EnregistrerUtilisateurRequest;
use App\Models\Role;
use App\Models\Utilisateur;
use App\Services\DroitsUtilisateurs;
use App\Services\HierarchieUtilisateurs;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UtilisateurController extends Controller
{
    public function __construct(private DroitsUtilisateurs $droits) {}

    public function index(Request $request): JsonResponse
    {
        $requete = Utilisateur::with('role:id,nom_role')
            ->where('entreprise_id', $request->user()->entreprise_id) // RG05
            ->orderBy('nom')->orderBy('prenom');

        foreach (['statut_compte' => 'statut', 'role_id' => 'role_id', 'departement_id' => 'departement_id'] as $colonne => $param) {
            if ($request->filled($param)) {
                $requete->where($colonne, $request->query($param));
            }
        }

        // CORRIGÉ : ilike (insensible à la casse sous PostgreSQL) et échappement de %, _ et \
        if ($request->filled('q')) {
            $q = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $request->query('q')).'%';
            $requete->where(fn ($w) => $w->where('nom', 'ilike', $q)
                ->orWhere('prenom', 'ilike', $q)
                ->orWhere('email', 'ilike', $q));
        }

        return response()->json(
            $requete->paginate(15)->through(fn ($u) => $this->formater($u))
        );
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return response()->json($this->formater($this->trouver($request, $id)));
    }

    public function store(EnregistrerUtilisateurRequest $request): JsonResponse
    {
        $appelant = $request->user();
        $donnees = $request->validated();
        $role = Role::where('entreprise_id', $appelant->entreprise_id)->findOrFail($donnees['role_id']);

        if (! $this->droits->roleAttribuable($appelant, $role)) { // RG32
            return response()->json(['message' => 'Vous ne pouvez pas attribuer un rôle plus élevé que le vôtre.'], 403);
        }

        $utilisateur = Utilisateur::create($donnees + [
            'entreprise_id' => $appelant->entreprise_id,
            'statut_compte' => 'actif',
        ]);

        return response()->json($this->formater($utilisateur->load('role:id,nom_role')), 201);
    }

    public function update(EnregistrerUtilisateurRequest $request, int $id): JsonResponse
    {
        $appelant = $request->user();
        $cible = $this->trouver($request, $id);
        if (! $this->droits->peutGerer($appelant, $cible)) { // RG32
            return response()->json(['message' => 'Ce compte possède des droits supérieurs aux vôtres.'], 403);
        }
        $donnees = $request->validated();
        if (empty($donnees)) {
            return response()->json(['message' => 'Aucun champ à modifier.'], 422);
        }

        // On ne bloque que les vrais changements : le formulaire peut renvoyer l'e-mail inchangé
        $emailChange = isset($donnees['email']) && $donnees['email'] !== $cible->email;
        $motDePasseChange = ! empty($donnees['mot_de_passe']);
        if (($emailChange || $motDePasseChange) && ! $this->droits->peutModifierIdentifiants($appelant, $cible)) {
            return response()->json([
                'message' => "Vous ne pouvez pas modifier l'e-mail ou le mot de passe d'un compte de niveau égal ou supérieur au vôtre.",
            ], 403);
        }

        if (! empty($donnees['superieur_id'])
            && app(HierarchieUtilisateurs::class)->creeUnCycle($cible->id, (int) $donnees['superieur_id'])) {
            return response()->json(['message' => 'Ce choix créerait une boucle hiérarchique.'], 422);
        }
        if (isset($donnees['role_id']) && (int) $donnees['role_id'] !== $cible->role_id) {
            $role = Role::where('entreprise_id', $appelant->entreprise_id)->findOrFail($donnees['role_id']);
            if (! $this->droits->roleAttribuable($appelant, $role)) { // RG32
                return response()->json(['message' => 'Vous ne pouvez pas attribuer un rôle plus élevé que le vôtre.'], 403);
            }
            if ($this->droits->estDernierAdminActif($cible)) { // RG33
                return response()->json(['message' => 'Le dernier administrateur actif ne peut pas changer de rôle.'], 422);
            }
        }

        $cible->update($donnees);

        // Changement d'e-mail ou de mot de passe par un tiers : les sessions du compte sont fermées
        if (($emailChange || $motDePasseChange) && $cible->id !== $appelant->id) {
            $cible->tokens()->delete();
        }

        return response()->json($this->formater($cible->load('role:id,nom_role')));
    }

    public function changerStatut(Request $request, int $id): JsonResponse
    {
        $request->validate(['actif' => ['required', 'boolean']]);

        $appelant = $request->user();
        $cible = $this->trouver($request, $id);
        $actif = $request->boolean('actif');

        if (! $this->droits->peutGerer($appelant, $cible)) { // RG32
            return response()->json(['message' => 'Ce compte possède des droits supérieurs aux vôtres.'], 403);
        }

        if (! $actif) {
            if ($cible->id === $appelant->id) { // RG33
                return response()->json(['message' => 'Vous ne pouvez pas désactiver votre propre compte.'], 422);
            }
            if ($this->droits->estDernierAdminActif($cible)) { // RG33
                return response()->json(['message' => 'Le dernier administrateur actif ne peut pas être désactivé.'], 422);
            }
        }

        $cible->statut_compte = $actif ? 'actif' : 'inactif';
        $cible->save();

        if (! $actif) {
            $cible->tokens()->delete(); // RG12 : jetons révoqués
        }

        return response()->json($this->formater($cible->load('role:id,nom_role')));
    }

    // Filtre sur l'entreprise de l'appelant : un compte d'une autre entreprise donne 404 (RG05)
    private function trouver(Request $request, int $id): Utilisateur
    {
        return Utilisateur::with('role:id,nom_role')
            ->where('entreprise_id', $request->user()->entreprise_id)
            ->findOrFail($id);
    }

    private function formater(Utilisateur $u): array
    {
        return [
            'id' => $u->id,
            'nom' => $u->nom,
            'prenom' => $u->prenom,
            'email' => $u->email,
            'telephone' => $u->telephone,
            'photo' => $u->photo,
            'poste' => $u->poste,
            'date_embauche' => $u->date_embauche,
            'statut_compte' => $u->statut_compte,
            'role_id' => $u->role_id,
            'role' => $u->role?->nom_role,
            'departement_id' => $u->departement_id,
            'superieur_id' => $u->superieur_id,
        ];
    }
}
