<?php

namespace App\Assistant\Tools;

use App\Models\Contenu;
use App\Models\Departement;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Validator;

class ModifierContenuTool implements ToolInterface
{
    use OutilsContenus;
    use OutilsOrganisation;
    use ResoutParNom;

    public function name(): string
    {
        return 'modifier_contenu';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => 'Modifie un contenu existant (titre, texte, catégorie, destinataires, expiration, numéro). '
                    .'Ne renseigner que les champs à changer. Désigner le contenu par son titre actuel (titre_actuel), ou son identifiant s\'il est connu. '
                    ."Le nouveau texte doit venir uniquement de ce que l'administrateur a fourni : ne jamais inventer de faits.",
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'type' => ['type' => 'string', 'enum' => self::TYPES_CONTENU, 'description' => 'Type de contenu'],
                        'titre_actuel' => ['type' => 'string', 'description' => 'Titre ACTUEL du contenu à modifier (exact ou partiel)'],
                        'id' => ['type' => 'integer', 'description' => 'Identifiant du contenu, seulement s\'il est connu (facultatif)'],
                        'titre' => ['type' => 'string', 'description' => 'Nouveau titre'],
                        'corps' => ['type' => 'string', 'description' => 'Nouveau texte complet'],
                        'categorie' => ['type' => 'string', 'description' => 'Nouvelle catégorie'],
                        'departement' => ['type' => 'string', 'description' => "Nom du département destinataire, ou « aucun » pour toute l'entreprise"],
                        'date_expiration' => ['type' => 'string', 'description' => "Nouvelle date d'expiration AAAA-MM-JJ (annonce seulement)"],
                        'numero_note' => ['type' => 'string', 'description' => 'Nouveau numéro (note de service seulement)'],
                    ],
                    'required' => ['type'],
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
        return $this->peutSurAuMoinsUnType($utilisateur, 'publier');
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $params = $this->renseignes($params);
        $type = $params['type'] ?? null;

        $validateur = Validator::make($params, [
            'type' => ['required', 'in:'.implode(',', self::TYPES_CONTENU)],
            'id' => ['nullable', 'integer', 'min:1'],
            'titre_actuel' => ['nullable', 'string', 'max:150'],
            'titre' => ['nullable', 'string', 'max:150'],
            'corps' => ['nullable', 'string', 'max:20000'],
            'categorie' => ['nullable', 'string', 'max:50'],
            'departement' => ['nullable', 'string', 'max:150'],
            'date_expiration' => $type === 'annonce' ? ['nullable', 'string'] : ['prohibited'],
            'numero_note' => $type === 'note_service' ? ['nullable', 'string', 'max:20'] : ['prohibited'],
        ], [
            'type.in' => 'Le type doit être actualite, annonce, article ou note_service.',
            'date_expiration.prohibited' => "La date d'expiration n'existe que pour les annonces.",
            'numero_note.prohibited' => 'Le numéro n\'existe que pour les notes de service.',
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();

        $contenu = $this->trouverContenuGerable($utilisateur, $d['type'], isset($d['id']) ? (int) $d['id'] : null, $d['titre_actuel'] ?? null);

        $changements = [];
        $canonique = ['type' => $d['type'], 'id' => $contenu->id];
        $visibilite = $contenu->visibilite;
        $departementId = $contenu->departement_id;

        foreach (['titre' => 'titre', 'corps' => 'texte', 'categorie' => 'catégorie'] as $cle => $libelle) {
            if (isset($d[$cle]) && trim($d[$cle]) !== (string) $contenu->{$cle}) {
                $canonique[$cle] = trim($d[$cle]);
                $changements[] = $cle === 'corps' ? 'texte remplacé' : "{$libelle} → ".trim($d[$cle]);
            }
        }

        if (isset($d['departement'])) {
            if ($this->estAucun($d['departement']) || $this->normaliser($d['departement']) === 'entreprise') {
                if ($visibilite !== 'entreprise') {
                    $changements[] = "destinataires → toute l'entreprise";
                }
                $visibilite = 'entreprise';
                $departementId = null;
                $canonique['departement'] = 'aucun';
            } else {
                $departements = Departement::where('entreprise_id', $utilisateur->entreprise_id)->get();
                $departement = $this->trouverParNom($departements, 'nom_departement', $d['departement']);
                if (! $departement) {
                    throw new ToolException("Département « {$d['departement']} » introuvable. Départements disponibles : "
                        .($departements->pluck('nom_departement')->implode(', ') ?: 'aucun').'.');
                }
                if ($visibilite !== 'departement' || $departementId !== $departement->id) {
                    $changements[] = "destinataires → département {$departement->nom_departement}";
                }
                $visibilite = 'departement';
                $departementId = $departement->id;
                $canonique['departement'] = $departement->nom_departement;
            }
        }

        if (! $this->acces()->peutCibler($utilisateur, $visibilite, $departementId)) {
            throw new ToolException('Un Manager ne publie que pour son département.');
        }

        if (isset($d['date_expiration'])) {
            if ($this->estAucun($d['date_expiration'])) {
                if ($contenu->date_expiration) {
                    $changements[] = 'expiration → aucune';
                }
                $canonique['date_expiration'] = 'aucune';
            } else {
                $date = Validator::make(['d' => $d['date_expiration']], ['d' => ['date', 'after_or_equal:today']]);
                if ($date->fails()) {
                    throw new ToolException("La date d'expiration doit être au format AAAA-MM-JJ et ne pas être passée.");
                }
                $iso = date('Y-m-d', strtotime($d['date_expiration']));
                if ($iso !== $contenu->date_expiration?->toDateString()) {
                    $changements[] = "expiration → {$iso}";
                }
                $canonique['date_expiration'] = $iso;
            }
        }

        if (isset($d['numero_note']) && trim($d['numero_note']) !== (string) $contenu->numero_note) {
            if (Contenu::where('entreprise_id', $utilisateur->entreprise_id)->where('numero_note', trim($d['numero_note']))->where('id', '!=', $contenu->id)->exists()) {
                throw new ToolException('Ce numéro de note est déjà utilisé.');
            }
            $canonique['numero_note'] = trim($d['numero_note']);
            $changements[] = 'numéro → '.trim($d['numero_note']);
        }

        if ($changements === []) {
            throw new ToolException('Aucun changement à appliquer : les valeurs demandées sont déjà celles du contenu.');
        }

        return $canonique + ['contenu' => $contenu->titre, 'changements' => $changements];
    }

    public function summary(array $params): string
    {
        $libelle = self::LIBELLES_CONTENU[$params['type']];
        $phrase = "Modifier l'{$libelle} « {$params['contenu']} » : ".implode(' ; ', $params['changements']).'.';

        // Le nouveau texte est montré en entier dans la carte de confirmation
        return isset($params['corps']) ? $phrase."\n\n".$params['corps'] : $phrase;
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $p = $this->validate($utilisateur, $params);
        $contenu = Contenu::where('entreprise_id', $utilisateur->entreprise_id)->findOrFail($p['id']);

        $colonnes = [];
        foreach (['titre', 'corps', 'categorie', 'numero_note'] as $cle) {
            if (isset($p[$cle])) {
                $colonnes[$cle] = $p[$cle];
            }
        }
        if (isset($p['departement'])) {
            if ($p['departement'] === 'aucun') {
                $colonnes['visibilite'] = 'entreprise';
                $colonnes['departement_id'] = null;
            } else {
                $colonnes['visibilite'] = 'departement';
                $colonnes['departement_id'] = Departement::where('entreprise_id', $utilisateur->entreprise_id)
                    ->where('nom_departement', $p['departement'])->value('id');
            }
        }
        if (isset($p['date_expiration'])) {
            $colonnes['date_expiration'] = $p['date_expiration'] === 'aucune' ? null : $p['date_expiration'];
        }
        $contenu->update($colonnes);

        $libelle = self::LIBELLES_CONTENU[$p['type']];

        return [
            'message' => "L'{$libelle} « {$contenu->titre} » a été modifiée.",
            'donnees' => ['id' => $contenu->id, 'type' => $p['type'], 'changements' => $p['changements']],
            'secret' => null,
        ];
    }
}
