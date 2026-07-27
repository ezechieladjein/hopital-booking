@component('mail::message')
# Rendez-vous confirmé !

Bonjour **{{ $appointment->patient->prenom }} {{ $appointment->patient->nom }}**,

Votre paiement de **{{ number_format($appointment->amount_to_pay, 0, ',', ' ') }} FCFA** a été validé avec succès. Votre rendez-vous est définitivement **CONFIRMÉ**.

**Récapitulatif de la consultation :**
- **Médecin :** Dr. {{ $appointment->slot->doctor->user->nom ?? '' }}
- **Spécialité :** {{ $appointment->slot->doctor->speciality->nom ?? 'Généraliste' }}
- **Date & Heure :** {{ \Carbon\Carbon::parse($appointment->slot->date_consultation)->format('d/m/Y') }} à {{ $appointment->slot->start_time }}

Cordialement,<br>
L'équipe {{ config('app.name') }}
@endcomponent