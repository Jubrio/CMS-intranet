<?php

return [

    /*
    | Assistant IA de l'administrateur : le modèle tourne en local via Ollama.
    */
    'ollama_url' => env('OLLAMA_URL', 'http://localhost:11434'),

    'modele' => env('ASSISTANT_MODELE', 'qwen2.5:7b'),

    // Délai maximal d'une réponse d'Ollama, en secondes (le premier appel charge le modèle en mémoire).
    'delai' => (int) env('ASSISTANT_DELAI', 180),

    // Nombre maximal d'allers-retours modèle <-> outils pour un seul message de l'administrateur.
    'max_tours' => 5,

    // Nombre de messages précédents renvoyés au modèle pour qu'il suive la conversation.
    'historique' => 20,

];
