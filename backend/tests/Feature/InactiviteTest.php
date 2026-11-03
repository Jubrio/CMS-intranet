<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\IntranetTestCase;

class InactiviteTest extends IntranetTestCase
{
    private function jeton(string $email): string
    {
        return $this->postJson('/api/login', ['email' => $email, 'mot_de_passe' => self::MOT_DE_PASSE])
            ->assertOk()->json('token');
    }

    public function test_un_jeton_recemment_utilise_reste_valide(): void
    {
        config(['sanctum.inactivite' => 30]);
        [, $admin] = $this->creerEntreprise('Alpha');
        $jeton = $this->jeton($admin->email);

        DB::table('personal_access_tokens')->update(['last_used_at' => now()->subMinutes(10)]);

        $this->withToken($jeton)->getJson('/api/me')->assertOk();
    }

    public function test_un_jeton_inutilise_depuis_trop_longtemps_est_refuse_puis_supprime(): void
    {
        config(['sanctum.inactivite' => 30]);
        [, $admin] = $this->creerEntreprise('Alpha');
        $jeton = $this->jeton($admin->email);

        DB::table('personal_access_tokens')->update(['last_used_at' => now()->subMinutes(45)]);

        $this->withToken($jeton)->getJson('/api/me')->assertUnauthorized();
        $this->assertSame(0, DB::table('personal_access_tokens')->count());
    }

    public function test_la_fenetre_d_inactivite_glisse_a_chaque_requete(): void
    {
        config(['sanctum.inactivite' => 30]);
        [, $admin] = $this->creerEntreprise('Alpha');
        $jeton = $this->jeton($admin->email);

        DB::table('personal_access_tokens')->update(['last_used_at' => now()->subMinutes(20)]);
        $this->withToken($jeton)->getJson('/api/me')->assertOk();

        $this->assertTrue(
            now()->subMinute()->lt(DB::table('personal_access_tokens')->value('last_used_at'))
        );
    }

    public function test_la_regle_peut_etre_desactivee(): void
    {
        config(['sanctum.inactivite' => 0]);
        [, $admin] = $this->creerEntreprise('Alpha');
        $jeton = $this->jeton($admin->email);

        DB::table('personal_access_tokens')->update(['last_used_at' => now()->subHours(5)]);

        $this->withToken($jeton)->getJson('/api/me')->assertOk();
    }
}
