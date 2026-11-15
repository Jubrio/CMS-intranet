<?php

namespace App\Assistant\Tools;

use App\Models\Evenement;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Validator;

class ListerEvenementsTool implements ToolInterface
{
    use OutilsModules;

    private const LIMITE = 20;

    public function name(): string
    {
        return 'lister_evenements';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => 'Liste les événements du calendrier sur une période (le mois en cours par défaut), avec leur identifiant. '
                    .'À appeler avant de modifier un événement pour retrouver son identifiant.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'debut' => ['type' => 'string', 'description' => 'Début de période AAAA-MM-JJ (facultatif)'],
                        'fin' => ['type' => 'string', 'description' => 'Fin de période AAAA-MM-JJ (facultatif)'],
                    ],
                ],
            ],
        ];
    }

    public function requiresConfirmation(): bool
    {
        return false;
    }

    public function authorize(Utilisateur $utilisateur): bool
    {
        return $this->droitsModules($utilisateur, ['calendrier', 'evenements'], ['calendrier.consulter', 'evenements.consulter']);
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $params = array_filter($params, fn ($v) => $v !== null && $v !== '');
        $debut = isset($params['debut']) ? $this->lireDate($params['debut'], false) : now()->startOfMonth();
        $fin = isset($params['fin']) ? $this->lireDate($params['fin'], true) : now()->endOfMonth();
        if ($fin->lt($debut)) {
            throw new ToolException('La fin de la période doit être après son début.');
        }
        if (abs($debut->diffInDays($fin)) > 366) {
            throw new ToolException('La période ne peut pas dépasser un an.');
        }

        return ['debut' => $debut->toDateString(), 'fin' => $fin->toDateString()];
    }

    public function summary(array $params): string
    {
        return 'Lister les événements.';
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $p = $this->validate($utilisateur, $params);
        $debut = $this->lireDate($p['debut'], false);
        $fin = $this->lireDate($p['fin'], true);

        // Mêmes événements visibles que EvenementController::index()
        $requete = Evenement::where('entreprise_id', $utilisateur->entreprise_id)
            ->where(function ($q) use ($utilisateur) {
                $q->where('visibilite', 'entreprise')->orWhere('auteur_id', $utilisateur->id);
                if ($utilisateur->departement_id) {
                    $q->orWhere(fn ($q2) => $q2->where('visibilite', 'departement')
                        ->where('departement_id', $utilisateur->departement_id));
                }
            })
            ->where('date_debut', '<=', $fin)->where('date_fin', '>=', $debut);

        $total = (clone $requete)->count();
        $lignes = $requete->orderBy('date_debut')->limit(self::LIMITE)->get()->map(fn (Evenement $e) => [
            'id' => $e->id,
            'titre' => $e->titre_evenement,
            'debut' => $e->date_debut->format('d/m/Y H:i'),
            'fin' => $e->date_fin->format('d/m/Y H:i'),
            'lieu' => $e->lieu,
            'visibilite' => $e->visibilite === 'departement' ? 'département' : 'toute l\'entreprise',
        ])->all();

        return [
            'message' => "{$total} événement(s) du {$debut->format('d/m/Y')} au {$fin->format('d/m/Y')}.",
            'donnees' => ['total' => $total, 'evenements' => $lignes],
            'secret' => null,
        ];
    }
}
