@component('mail::message')
# Prise en charge assurance validée

Bonjour **{{ $appointment->patient->prenom }} {{ $appointment->patient->nom }}**,

Bonne nouvelle ! Votre prise en charge d'assurance a été validée par le secrétariat.

**Nouveau montant à régler :**
- **Montant initial :** {{ number_format($appointment->base_price, 0, ',', ' ') }} FCFA
- **Reste à charge (après assurance) :** {{ number_format($appointment->amount_to_pay, 0, ',', ' ') }} FCFA

Vous pouvez dès à présent procéder au paiement pour confirmer définitivement votre rendez-vous.

@component('mail::button', ['url' => $paymentUrl])
Procéder au paiement
@endcomponent

Cordialement,<br>
L'équipe {{ config('app.name') }}
@endcomponent