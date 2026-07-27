@component('mail::message')
# Annulation de rendez-vous

Bonjour **{{ $appointment->patient->prenom }} {{ $appointment->patient->nom }}**,

Votre rendez-vous prévu le **{{ \Carbon\Carbon::parse($appointment->slot->date_consultation)->format('d/m/Y') }} à {{ $appointment->slot->start_time }}** avec le **Dr. {{ $appointment->slot->doctor->prenom }} {{ $appointment->slot->doctor->nom }}** a été annulé.

**Annulé par :** {{ $cancelledBy }}  
**Motif :** {{ $reason ?? ($appointment->cancellation_reason ?? 'Non précisé') }}

Cordialement,<br>
L'équipe {{ config('app.name') }}
@endcomponent