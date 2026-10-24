<?php

namespace App\Services;

use App\Models\ModuleEntreprise;
use App\Models\Notification;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\DB;
use Throwable;

// Diffusion des notifications : qui a fait quoi, adressé à toute l'entreprise ou à un seul département.
// Même règle de visibilité que les contenus, événements et documents (RG05, RG22) :
// un département ciblé = seuls ses membres sont notifiés, les autres ne reçoivent rien.
class NotificationService
{
    // Type d'objet => [modules qui doivent être actifs, permissions de consultation exigées du destinataire]
    private const CIBLES = [
        'actualite' => [['actualites'], ['actualites.consulter']],
        'annonce' => [['annonces'], ['annonces.consulter']],
        'article' => [['articles'], ['articles.consulter']],
        'note_service' => [['notes_service'], ['notes_service.consulter']],
        'evenement' => [['calendrier', 'evenements'], ['calendrier.consulter', 'evenements.consulter']],
        'document' => [['documents'], ['documents.consulter']],
    ];

    private const PAR_LOT = 500;

    // Une notification ne doit jamais faire échouer l'action qui la déclenche : l'erreur est journalisée.
    public function publier(
        Utilisateur $acteur,
        string $action,
        string $objetType,
        int $objetId,
        string $titre,
        ?int $departementId = null,
    ): void {
        try {
            $this->diffuser($acteur, $action, $objetType, $objetId, $titre, $departementId);
        } catch (Throwable $e) {
            report($e);
        }
    }

    // L'objet est supprimé ou archivé : ses notifications disparaissent (les lignes destinataires partent en cascade)
    public function retirer(string $objetType, int $objetId): void
    {
        try {
            Notification::where('objet_type', $objetType)->where('objet_id', $objetId)->delete();
        } catch (Throwable $e) {
            report($e);
        }
    }

    private function diffuser(
        Utilisateur $acteur,
        string $action,
        string $objetType,
        int $objetId,
        string $titre,
        ?int $departementId,
    ): void {
        if (! $acteur->entreprise_id || ! isset(self::CIBLES[$objetType])) {
            return;
        }
        [$modules, $permissions] = self::CIBLES[$objetType];

        // Module désactivé : rien n'est diffusé (RG10)
        $actifs = ModuleEntreprise::where('entreprise_id', $acteur->entreprise_id)
            ->where('module_actif', true)
            ->whereHas('module', fn ($q) => $q->whereIn('code_module', $modules))
            ->count();
        if ($actifs < count($modules)) {
            return;
        }

        $destinataires = Utilisateur::where('entreprise_id', $acteur->entreprise_id)
            ->where('statut_compte', 'actif')
            ->where('id', '!=', $acteur->id);
        if ($departementId !== null) {
            $destinataires->where('departement_id', $departementId);
        }
        // Seuls ceux qui ont le droit de consulter l'objet sont notifiés
        foreach ($permissions as $permission) {
            $destinataires->whereHas('role.permissions', fn ($q) => $q->where('code_permission', $permission));
        }
        $ids = $destinataires->pluck('id');
        if ($ids->isEmpty()) {
            return;
        }

        DB::transaction(function () use ($acteur, $action, $objetType, $objetId, $titre, $departementId, $ids) {
            $notification = Notification::create([
                'entreprise_id' => $acteur->entreprise_id,
                'acteur_id' => $acteur->id,
                'departement_id' => $departementId,
                'action' => $action,
                'objet_type' => $objetType,
                'objet_id' => $objetId,
                'titre' => mb_substr($titre, 0, 200),
            ]);

            foreach ($ids->chunk(self::PAR_LOT) as $lot) {
                DB::table('notification_utilisateurs')->insert(
                    $lot->map(fn ($id) => [
                        'notification_id' => $notification->id,
                        'utilisateur_id' => $id,
                        'lu_at' => null,
                    ])->all()
                );
            }
        });
    }
}
