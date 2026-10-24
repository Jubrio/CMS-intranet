<?php

namespace Tests\Feature;

use Tests\TestCase;

class ExampleTest extends TestCase
{
    // Le test d'exemple de Laravel appelait « / » (page Blade avec @vite, qui exige des assets
    // compilés). Le backend ne sert que l'API : on vérifie son point de santé, sans base de données.
    public function test_l_api_repond_sur_son_point_de_sante(): void
    {
        $this->getJson('/api/health')->assertOk()->assertExactJson(['status' => 'ok']);
    }
}
