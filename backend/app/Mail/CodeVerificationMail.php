<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class CodeVerificationMail extends Mailable
{
    public function __construct(
        public string $code,
        public string $objet, // inscription | mot_de_passe
        public int $minutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->objet === 'mot_de_passe'
                ? 'Votre code de réinitialisation du mot de passe'
                : 'Votre code de vérification',
        );
    }

    public function content(): Content
    {
        return new Content(view: 'mail.code');
    }
}
