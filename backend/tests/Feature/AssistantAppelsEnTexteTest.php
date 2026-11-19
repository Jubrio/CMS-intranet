<?php

namespace Tests\Feature;

use App\Assistant\AppelsEnTexte;
use PHPUnit\Framework\TestCase;

class AssistantAppelsEnTexteTest extends TestCase
{
    private const OUTILS = ['publier_contenu', 'lister_utilisateurs'];

    public function test_appel_ecrit_dans_le_texte(): void
    {
        $r = AppelsEnTexte::extraire('publier_contenu {"type": "actualite", "titre": "test", "corps": "okok"}', self::OUTILS);

        $this->assertSame('publier_contenu', $r[0]['function']['name']);
        $this->assertSame('actualite', $r[0]['function']['arguments']['type']);
    }

    public function test_formes_json_et_balises(): void
    {
        $a = AppelsEnTexte::extraire('<tool_call>{"name": "lister_utilisateurs", "arguments": {}}</tool_call>', self::OUTILS);
        $this->assertSame('lister_utilisateurs', $a[0]['function']['name']);
        $this->assertInstanceOf(\stdClass::class, $a[0]['function']['arguments']);

        $b = AppelsEnTexte::extraire("```json\n{\"name\": \"publier_contenu\", \"arguments\": {\"type\": \"annonce\"}}\n```", self::OUTILS);
        $this->assertSame('annonce', $b[0]['function']['arguments']['type']);
    }

    public function test_texte_normal_ou_outil_inconnu_ne_declenche_rien(): void
    {
        $this->assertSame([], AppelsEnTexte::extraire('Je peux publier un contenu. Quel titre ?', self::OUTILS));
        $this->assertSame([], AppelsEnTexte::extraire('supprimer_tout {"a": 1}', self::OUTILS));
        $this->assertSame([], AppelsEnTexte::extraire('Voici : publier_contenu {"type": "actualite"} voilà', self::OUTILS));
        $this->assertSame([], AppelsEnTexte::extraire('publier_contenu {pas du json}', self::OUTILS));
    }
}
