<?php

namespace App\Assistant\Tools;

use App\Models\Departement;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Validator;

class CreerDepartementTool implements ToolInterface
{
    use OutilsOrganisation;
    use ResoutParNom;

    public function name(): string
    {
        return 'creer_departement';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => "Crée un département dans l'entreprise.",
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'nom' => ['type' => 'string', 'description' => 'Nom du département'],
                        'description' => ['type' => 'string', 'description' => 'Description (facultatif)'],
                        'parent' => ['type' => 'string', 'description' => 'Nom du département parent (facultatif)'],
                        'responsable' => ['type' => 'string', 'description' => 'E-mail du responsable (facultatif)'],
                    ],
                    'required' => ['nom'],
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

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $validateur = Validator::make($this->renseignes($params), [
            'nom' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:1000'],
            'parent' => ['nullable', 'string', 'max:150'],
            'responsable' => ['nullable', 'email'],
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();
        $departements = Departement::where('entreprise_id', $utilisateur->entreprise_id)->get();

        if ($this->trouverParNom($departements, 'nom_departement', $d['nom'])) {
            throw new ToolException("Un département « {$d['nom']} » existe déjà.");
        }

        $parent = null;
        if (isset($d['parent'])) {
            $parent = $this->trouverParNom($departements, 'nom_departement', $d['parent']);
            if (! $parent) {
                throw new ToolException("Département parent « {$d['parent']} » introuvable. Départements disponibles : "
                    .($departements->pluck('nom_departement')->implode(', ') ?: 'aucun').'.');
            }
        }
        $responsable = isset($d['responsable']) ? $this->trouverUtilisateur($utilisateur, $d['responsable']) : null;

        return [
            'nom' => trim($d['nom']),
            'description' => $d['description'] ?? null,
            'parent' => $parent?->nom_departement,
            'responsable' => $responsable?->email,
            'responsable_nom' => $responsable ? $this->nomComplet($responsable) : null,
        ];
    }

    public function summary(array $params): string
    {
        $phrase = "Créer le département « {$params['nom']} »";
        if ($params['parent']) {
            $phrase .= ", sous « {$params['parent']} »";
        }
        if ($params['responsable_nom']) {
            $phrase .= ", responsable {$params['responsable_nom']}";
        }

        return $phrase.'.';
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $p = $this->validate($utilisateur, $params);
        $entrepriseId = $utilisateur->entreprise_id;

        $departement = Departement::create([
            'entreprise_id' => $entrepriseId,
            'nom_departement' => $p['nom'],
            'description_departement' => $p['description'],
            'departement_parent_id' => $p['parent']
                ? Departement::where('entreprise_id', $entrepriseId)->where('nom_departement', $p['parent'])->value('id') : null,
            'responsable_id' => $p['responsable'] ? $this->trouverUtilisateur($utilisateur, $p['responsable'])->id : null,
        ]);

        return [
            'message' => "Le département « {$departement->nom_departement} » a été créé.",
            'donnees' => ['id' => $departement->id, 'nom' => $departement->nom_departement],
            'secret' => null,
        ];
    }
}
