@component('mail::message')
# Modification de votre rendez-vous

Bonjour **{{ $appointment->patient->prenom }} {{ $appointment->patient->nom }}**,

Les informations de votre rendez-vous avec le **Dr. {{ $appointment->slot->doctor->prenom }} {{ $appointment->slot->doctor->nom }}** ont été mises à jour.

**Nouvelles informations :**
- **Date & Heure :** {{ \Carbon\Carbon::parse($appointment->slot->date_consultation)->format('d/m/Y') }} à {{ $appointment->slot->start_time }}

Cordialement,<br>
L'équipe {{ config('app.name') }}
@endcomponent