<!doctype html>
<html lang="fr">
<body style="font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.5;">
    <p>Bonjour,</p>

    @if ($objet === 'mot_de_passe')
        <p>Voici votre code pour réinitialiser votre mot de passe :</p>
    @else
        <p>Voici votre code pour confirmer votre adresse e-mail et créer votre intranet :</p>
    @endif

    <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0;">{{ $code }}</p>

    <p>Ce code est valable {{ $minutes }} minutes. Ne le communiquez à personne.</p>
    <p style="color: #6b7280; font-size: 13px;">
        Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message : rien ne sera modifié.
    </p>
</body>
</html>
