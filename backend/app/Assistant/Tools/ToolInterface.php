<?php

namespace App\Assistant\Tools;

use App\Models\Utilisateur;

interface ToolInterface
{
    /** Nom de l'outil tel que le modèle l'appelle. */
    public function name(): string;

    /** Définition envoyée au modèle (format Ollama : type, function, parameters). */
    public function schema(): array;

    /** Faut-il une confirmation de l'administrateur avant d'exécuter ? */
    public function requiresConfirmation(): bool;

    /** L'utilisateur connecté a-t-il le droit d'utiliser cet outil ? */
    public function authorize(Utilisateur $utilisateur): bool;

    /**
     * Contrôle et normalise les paramètres reçus du modèle (noms résolus en identifiants,
     * droits métier vérifiés). Lance ToolException avec un message exploitable par le modèle.
     */
    public function validate(Utilisateur $utilisateur, array $params): array;

    /** Phrase de récapitulatif affichée dans la carte de confirmation. */
    public function summary(array $params): string;

    /**
     * Exécute l'action avec les droits de $utilisateur.
     *
     * @return array{message: string, donnees: array, secret: array|null}
     *                                                                    'donnees' peut être stocké et renvoyé au modèle ; 'secret' va uniquement à l'écran
     *                                                                    de l'administrateur (jamais en base, jamais au modèle).
     */
    public function execute(Utilisateur $utilisateur, array $params): array;
}
