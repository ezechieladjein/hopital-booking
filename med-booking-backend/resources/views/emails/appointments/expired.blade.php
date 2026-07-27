@component('mail::message')
# Demande de rendez-vous expirée

Bonjour **{{ $appointment->patient->prenom }} {{ $appointment->patient->nom }}**,

Le délai imparti pour le règlement de votre rendez-vous du **{{ \Carbon\Carbon::parse($appointment->slot->date_consultation)->format('d/m/Y') }} à {{ $appointment->slot->start_time }}** est écoulé.

Votre demande a été marquée comme **EXPIRÉE** et le créneau horaire a été libéré.

@component('mail::button', ['url' => config('app.url') . '/booking'])
Planifier un nouveau rendez-vous
@endcomponent

Cordialement,<br>
L'équipe {{ config('app.name') }}
@endcomponent