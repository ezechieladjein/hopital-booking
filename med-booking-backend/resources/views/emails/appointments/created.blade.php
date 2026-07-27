@component('mail::message')
# Demande de rendez-vous enregistrée

Bonjour **{{ $appointment->patient->prenom }} {{ $appointment->patient->nom }}**,

Votre demande de rendez-vous a bien été enregistrée.

**Détails de la demande :**
- **Médecin :** Dr. {{ $appointment->slot->doctor->prenom }} {{ $appointment->slot->doctor->nom }}
- **Date & Heure :** {{ \Carbon\Carbon::parse($appointment->slot->date_consultation)->format('d/m/Y') }} à {{ $appointment->slot->start_time }}
- **Statut actuel :** En attente de validation

Vous recevrez une notification dès que votre demande aura été examinée par notre équipe.

Cordialement,<br>
L'équipe {{ config('app.name') }}
@endcomponent