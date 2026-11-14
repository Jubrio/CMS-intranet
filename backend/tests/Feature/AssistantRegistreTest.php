<?php

namespace Tests\Feature;

use App\Assistant\ToolRegistry;
use Tests\IntranetTestCase;

class AssistantRegistreTest extends IntranetTestCase
{
    public function test_un_administrateur_voit_l_outil_de_creation(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');

        $noms = collect(app(ToolRegistry::class)->schemasPour($admin))->pluck('function.name')->all();

        $this->assertContains('creer_utilisateur', $noms);
    }

    public function test_un_employe_ne_voit_aucun_outil(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');

        $this->assertSame([], app(ToolRegistry::class)->schemasPour($employe));
    }

    public function test_un_outil_inconnu_est_introuvable(): void
    {
        $this->assertNull(app(ToolRegistry::class)->trouver('supprimer_tout'));
        $this->assertNotNull(app(ToolRegistry::class)->trouver('creer_utilisateur'));
    }
}
