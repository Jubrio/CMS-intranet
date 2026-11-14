<?php

namespace App\Assistant;

use RuntimeException;

/** Ollama est injoignable ou a répondu par une erreur. */
class AssistantIndisponible extends RuntimeException
{
    public function __construct()
    {
        parent::__construct("L'assistant local est indisponible. Vérifiez que Ollama est lancé et que le modèle est installé.");
    }
}
