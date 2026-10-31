<?php

namespace App\Mail;

use Illuminate\Support\Facades\Http;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\MessageConverter;

/**
 * Envoi des e-mails par l'API HTTPS de Brevo (port 443).
 * Utile sur les hébergeurs gratuits qui bloquent les ports SMTP (25, 465, 587), comme Render.
 */
class BrevoTransport extends AbstractTransport
{
    public function __construct(private readonly string $cle)
    {
        parent::__construct();
    }

    protected function doSend(SentMessage $message): void
    {
        /** @var Email $email */
        $email = MessageConverter::toEmail($message->getOriginalMessage());
        $envelope = $message->getEnvelope();

        $expediteur = $envelope->getSender();
        $charge = [
            'sender' => ['email' => $expediteur->getAddress(), 'name' => $expediteur->getName() ?: null],
            'to' => array_map(fn (Address $a) => ['email' => $a->getAddress(), 'name' => $a->getName() ?: null], $email->getTo()),
            'subject' => $email->getSubject() ?? '',
        ];

        if ($email->getHtmlBody()) {
            $charge['htmlContent'] = $email->getHtmlBody();
        }
        if ($email->getTextBody()) {
            $charge['textContent'] = $email->getTextBody();
        }
        if (! isset($charge['htmlContent']) && ! isset($charge['textContent'])) {
            $charge['textContent'] = ' ';
        }

        // Retire les champs vides (nom null) que l'API refuse
        $charge['sender'] = array_filter($charge['sender']);
        $charge['to'] = array_map('array_filter', $charge['to']);

        $reponse = Http::withHeaders(['api-key' => $this->cle, 'accept' => 'application/json'])
            ->timeout(15)
            ->post('https://api.brevo.com/v3/smtp/email', $charge);

        if ($reponse->failed()) {
            throw new TransportException('Brevo a refusé l\'envoi : '.$reponse->status().' '.$reponse->body());
        }
    }

    public function __toString(): string
    {
        return 'brevo';
    }
}
