<?php

namespace App\Assistant;

/**
 * Certains modèles locaux (qwen2.5 notamment) écrivent l'appel d'outil dans le texte de leur réponse
 * au lieu d'utiliser le champ prévu : « publier_contenu {"type": "actualite", ...} ».
 * On le reconnaît seulement si TOUT le message est un appel à un outil connu ; Laravel le valide ensuite comme un autre.
 */
class AppelsEnTexte
{
    /**
     * @param  list<string>  $outilsConnus
     * @return list<array{function: array{name: string, arguments: array|\stdClass}}>
     */
    public static function extraire(string $contenu, array $outilsConnus): array
    {
        $texte = trim(preg_replace('/<\/?tool_call>/i', '', $contenu));
        $texte = trim(preg_replace('/^```(?:json)?\s*|\s*```$/i', '', $texte));
        if ($texte === '') {
            return [];
        }

        $nom = null;
        $json = null;

        // Forme 1 : nom_outil {"cle": "valeur"}  (ou nom_outil({...}) / nom_outil: {...})
        if (preg_match('/^([a-z_]+)\s*[:(]?\s*(\{.*\})\s*\)?$/su', $texte, $m) && in_array($m[1], $outilsConnus, true)) {
            $nom = $m[1];
            $json = $m[2];
        } elseif (preg_match('/^\{.*\}$/su', $texte)) {
            // Forme 2 : {"name": "nom_outil", "arguments": {...}}
            $objet = json_decode($texte, true);
            if (is_array($objet) && in_array($objet['name'] ?? null, $outilsConnus, true)) {
                $nom = $objet['name'];
                $json = json_encode($objet['arguments'] ?? $objet['parameters'] ?? new \stdClass);
            }            elseif (is_array($objet) && count($objet) === 1 && in_array(array_key_first($objet), $outilsConnus, true) && is_array(reset($objet))) {
                // Forme 2 bis : {"outil": {...arguments...}}
                $nom = array_key_first($objet);
                $json = json_encode(reset($objet));
            }
        }

        // Forme 3 : une phrase d'introduction, puis {"name": "outil", "arguments": {...}} (Laravel valide ensuite)
        if (($nom === null || $json === null) && preg_match('/\{\s*"name"\s*:\s*"([a-z_]+)"\s*,\s*"(?:arguments|parameters)"\s*:\s*(\{.*\})\s*\}/su', $texte, $m)
            && in_array($m[1], $outilsConnus, true)) {
            $nom = $m[1];
            $json = $m[2];
        }

        if ($nom === null || $json === null) {
            return [];
        }

        $arguments = json_decode($json, true);
        if (! is_array($arguments)) {
            return [];
        }

        return [['function' => ['name' => $nom, 'arguments' => $arguments === [] ? new \stdClass : $arguments]]];
    }
}
