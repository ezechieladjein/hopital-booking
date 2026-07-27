@component('mail::message')
# Demande de rendez-vous non retenue

Bonjour **{{ $appointment->patient->prenom }} {{ $appointment->patient->nom }}**,

Nous n'avons malheureusement pas pu valider votre demande de rendez-vous prévue le **{{ \Carbon\Carbon::parse($appointment->slot->date_consultation)->format('d/m/Y') }} à {{ $appointment->slot->start_time }}** avec le **Dr. {{ $appointment->slot->doctor->prenom }} {{ $appointment->slot->doctor->nom }}**.

**Motif du refus :**
> {{ $reason ?? ($appointment->cancellation_reason ?? 'Non précisé') }}

Si vous avez des questions, n'hésitez pas à nous contacter ou à planifier un nouveau créneau.

@component('mail::button', ['url' => config('app.frontend_url', config('app.url')) . '/booking'])
Reprendre un rendez-vous
@endcomponent

Cordialement,<br>
L'équipe {{ config('app.name') }}
@endcomponent