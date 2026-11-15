<?php

namespace App\Assistant\Tools;

use App\Models\Departement;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Validator;

class ModifierDepartementTool implements ToolInterface
{
    use OutilsOrganisation;
    use ResoutParNom;

    public function name(): string
    {
        return 'modifier_departement';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => 'Modifie un département : nom, description, département parent ou responsable. '
                    .'Ne renseigner que les champs à changer. Pour retirer le parent ou le responsable, mettre « aucun ».',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'departement' => ['type' => 'string', 'description' => 'Nom ACTUEL du département à modifier'],
                        'nouveau_nom' => ['type' => 'string', 'description' => 'Nouveau nom'],
                        'description' => ['type' => 'string', 'description' => 'Nouvelle description'],
                        'parent' => ['type' => 'string', 'description' => 'Nom du département parent, ou « aucun »'],
                        'responsable' => ['type' => 'string', 'description' => 'E-mail du responsable, ou « aucun »'],
                    ],
                    'required' => ['departement'],
                ],
            ],
        ];
    }

    public function requiresConfirmation(): bool
    {
        return true;
    }

    public function authorize(Utilisateur $utilisateur): bool
    {
        return $this->aPermission($utilisateur, 'utilisateurs.departements');
    }

    /** @return array{0: array, 1: array, 2: array} colonnes à écrire, libellés des changements, paramètres canoniques */
    private function analyser(Utilisateur $utilisateur, array $params): array
    {
        $validateur = Validator::make($this->renseignes($params), [
            'departement' => ['required', 'string', 'max:150'],
            'nouveau_nom' => ['nullable', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:1000'],
            'parent' => ['nullable', 'string', 'max:150'],
            'responsable' => ['nullable', 'string', 'max:255'],
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();
        $departements = Departement::where('entreprise_id', $utilisateur->entreprise_id)->get();

        $cible = $this->trouverParNom($departements, 'nom_departement', $d['departement']);
        if (! $cible) {
            throw new ToolException("Département « {$d['departement']} » introuvable. Départements disponibles : "
                .($departements->pluck('nom_departement')->implode(', ') ?: 'aucun').'.');
        }

        $colonnes = [];
        $changements = [];
        $canonique = ['departement' => $cible->nom_departement];

        if (isset($d['nouveau_nom']) && trim($d['nouveau_nom']) !== $cible->nom_departement) {
            $existant = $this->trouverParNom($departements, 'nom_departement', $d['nouveau_nom']);
            if ($existant && $existant->id !== $cible->id) {
                throw new ToolException("Un département « {$d['nouveau_nom']} » existe déjà.");
            }
            $colonnes['nom_departement'] = trim($d['nouveau_nom']);
            $canonique['nouveau_nom'] = $colonnes['nom_departement'];
            $changements[] = "nom → {$colonnes['nom_departement']}";
        }

        if (isset($d['description']) && $d['description'] !== (string) $cible->description_departement) {
            $colonnes['description_departement'] = $d['description'];
            $canonique['description'] = $d['description'];
            $changements[] = 'description mise à jour';
        }

        if (isset($d['parent'])) {
            if ($this->estAucun($d['parent'])) {
                if ($cible->departement_parent_id !== null) {
                    $colonnes['departement_parent_id'] = null;
                    $changements[] = 'parent → aucun';
                }
                $canonique['parent'] = 'aucun';
            } else {
                $parent = $this->trouverParNom($departements, 'nom_departement', $d['parent']);
                if (! $parent) {
                    throw new ToolException("Département parent « {$d['parent']} » introuvable. Départements disponibles : "
                        .$departements->pluck('nom_departement')->implode(', ').'.');
                }
                if ($this->creeUnCycle($cible->id, $parent->id)) {
                    throw new ToolException('Une hiérarchie circulaire est interdite.');
                }
                if ($parent->id !== $cible->departement_parent_id) {
                    $colonnes['departement_parent_id'] = $parent->id;
                    $changements[] = "parent → {$parent->nom_departement}";
                }
                $canonique['parent'] = $parent->nom_departement;
            }
        }

        if (isset($d['responsable'])) {
            if ($this->estAucun($d['responsable'])) {
                if ($cible->responsable_id !== null) {
                    $colonnes['responsable_id'] = null;
                    $changements[] = 'responsable → aucun';
                }
                $canonique['responsable'] = 'aucun';
            } else {
                $responsable = $this->trouverUtilisateur($utilisateur, $d['responsable']);
                if ($responsable->id !== $cible->responsable_id) {
                    $colonnes['responsable_id'] = $responsable->id;
                    $changements[] = 'responsable → '.$this->nomComplet($responsable);
                }
                $canonique['responsable'] = $responsable->email;
            }
        }

        if ($colonnes === []) {
            throw new ToolException('Aucun changement à appliquer : les valeurs demandées sont déjà celles du département.');
        }

        return [$cible, $colonnes, $canonique + ['changements' => $changements]];
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        [, , $canonique] = $this->analyser($utilisateur, $params);

        return $canonique;
    }

    public function summary(array $params): string
    {
        return "Modifier le département « {$params['departement']} » : ".implode(' ; ', $params['changements']).'.';
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        [$departement, $colonnes, $canonique] = $this->analyser($utilisateur, $params);
        $departement->update($colonnes);

        return [
            'message' => "Le département « {$departement->nom_departement} » a été modifié.",
            'donnees' => ['id' => $departement->id, 'changements' => $canonique['changements']],
            'secret' => null,
        ];
    }

    private function creeUnCycle(int $id, ?int $parentId): bool
    {
        $courant = $parentId;
        $vus = [];
        while ($courant !== null) {
            $courant = (int) $courant;
            if ($courant === $id || isset($vus[$courant])) {
                return true;
            }
            $vus[$courant] = true;
            $courant = Departement::where('id', $courant)->value('departement_parent_id');
        }

        return false;
    }
}
