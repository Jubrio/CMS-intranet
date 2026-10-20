<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Personnalisation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PersonnalisationController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $entreprise = $request->user()->entreprise;
        if (! $entreprise) {
            return response()->json(['message' => 'Aucune entreprise associée.'], 403);
        }
        return response()->json($this->donnees($entreprise));
    }

    public function updateApparence(Request $request): JsonResponse
    {
        $entreprise = $request->user()->entreprise;
        if (! $entreprise) {
            return response()->json(['message' => 'Aucune entreprise associée.'], 403);
        }

        $data = $request->validate([
            'couleur_principale' => ['sometimes', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'couleur_secondaire' => ['sometimes', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ], [
            'regex' => 'Format attendu : #RRGGBB (ex. #1D4ED8).',
        ]);

        $entreprise->personnalisation()->updateOrCreate([], $data);

        return response()->json($this->donnees($entreprise->fresh()));
    }

    public function updateLogo(Request $request): JsonResponse
    {
        $entreprise = $request->user()->entreprise;
        if (! $entreprise) {
            return response()->json(['message' => 'Aucune entreprise associée.'], 403);
        }

        $request->validate([
            'logo' => ['required', 'file', 'mimes:png,jpg,jpeg,webp', 'max:2048'], 
        ]);

        $perso = $entreprise->personnalisation()->firstOrCreate([]);
        if ($perso->logo) {
            Storage::disk('public')->delete($perso->logo);
        }
        $perso->update([
            'logo' => $request->file('logo')->store('logos/' . $entreprise->id, 'public'),
        ]);

        return response()->json($this->donnees($entreprise->fresh()));
    }

    public function updateParametres(Request $request): JsonResponse
    {
        $entreprise = $request->user()->entreprise;
        if (! $entreprise) {
            return response()->json(['message' => 'Aucune entreprise associée.'], 403);
        }

        $data = $request->validate([
            'nom_entreprise' => ['sometimes', 'string', 'max:100'],
            'email_contact' => ['sometimes', 'nullable', 'email', 'max:100'],
        ]);
        $entreprise->update($data);

        return response()->json($this->donnees($entreprise->fresh()));
    }

    private function donnees($entreprise): array
    {
        $p = $entreprise->personnalisation;
        return [
            'nom_entreprise' => $entreprise->nom_entreprise,
            'slug' => $entreprise->slug,
            'email_contact' => $entreprise->email_contact,
            'logo_url' => $p?->logo ? asset('storage/' . $p->logo) : null,
            'couleur_principale' => $p?->couleur_principale ?? '#1D4ED8',
            'couleur_secondaire' => $p?->couleur_secondaire ?? '#475569',
        ];
    }
}