<?php

namespace App\Services;

use App\Models\Entreprise;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Suppression définitive d'une entreprise et de toutes ses données.
 *
 * Plusieurs clés étrangères (auteur, utilisateur) sont en RESTRICT : une suppression en cascade
 * depuis l'entreprise échouerait selon l'ordre de traitement. On supprime donc explicitement,
 * des tables qui dépendent des utilisateurs vers les utilisateurs, puis les rôles, puis l'entreprise.
 */
class SuppressionEntreprise
{
    public function supprimer(Entreprise $entreprise): void
    {
        $id = $entreprise->id;
        $photos = Utilisateur::where('entreprise_id', $id)->whereNotNull('photo')->pluck('photo')->all();

        DB::transaction(function () use ($id) {
            DB::table('personal_access_tokens')
                ->where('tokenable_type', Utilisateur::class)
                ->whereIn('tokenable_id', Utilisateur::where('entreprise_id', $id)->select('id'))
                ->delete();

            // Notifications (les lignes de destinataires partent en cascade), lectures, réponses
            DB::table('notifications')->where('entreprise_id', $id)->delete();
            DB::table('lectures_notes')->where('entreprise_id', $id)->delete();
            DB::table('reponses')->where('entreprise_id', $id)->delete();

            // Contenus et ce qui s'y rattache
            DB::table('images')->where('entreprise_id', $id)->delete();
            DB::table('contenus')->where('entreprise_id', $id)->delete();
            DB::table('documents')->where('entreprise_id', $id)->delete();
            DB::table('evenements')->where('entreprise_id', $id)->delete();
            DB::table('questions_faq')->where('entreprise_id', $id)->delete();
            DB::table('formulaires')->where('entreprise_id', $id)->delete();

            // Structure : les responsables et supérieurs sont remis à zéro par les clés (SET NULL)
            DB::table('utilisateurs')->where('entreprise_id', $id)->delete();
            DB::table('roles')->where('entreprise_id', $id)->delete();

            // Le reste (départements, menus, modules, personnalisation) part en cascade
            Entreprise::whereKey($id)->delete();
        });

        // Fichiers stockés : après la validation de la transaction, au mieux
        $disque = Storage::disk(FichiersProfil::DISQUE);
        foreach (['documents', 'pages', 'contenus', 'logos'] as $dossier) {
            $disque->deleteDirectory($dossier.'/'.$id);
        }
        foreach ($photos as $photo) {
            $disque->delete($photo);
        }
    }
}
