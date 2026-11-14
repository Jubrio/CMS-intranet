<?php

namespace App\Assistant\Tools;

use RuntimeException;

/** Erreur d'un outil dont le message peut être montré à l'administrateur et renvoyé au modèle. */
class ToolException extends RuntimeException {}
