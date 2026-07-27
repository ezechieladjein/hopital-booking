@component('mail::message')
# Rappel : Consultation demain

Bonjour **{{ $appointment->patient->prenom }} {{ $appointment->patient->nom }}**,

Ceci est un rappel pour votre rendez-vous médical prévu demain :

- **Médecin :** Dr. {{ $appointment->slot->doctor->prenom }} {{ $appointment->slot->doctor->nom }}
- **Date & Heure :** {{ \Carbon\Carbon::parse($appointment->slot->date_consultation)->format('d/m/Y') }} à {{ $appointment->slot->start_time }}

Merci de vous présenter 15 minutes avant l'heure fixée, muni(e) de vos pièces justificatives si nécessaire.

Cordialement,<br>
L'équipe {{ config('app.name') }}
@endcomponent