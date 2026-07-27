@component('mail::message')
# Lien de paiement pour votre consultation

Bonjour **{{ $appointment->patient->prenom }} {{ $appointment->patient->nom }}**,

Le lien de paiement pour votre rendez-vous du **{{ \Carbon\Carbon::parse($appointment->slot->date_consultation)->format('d/m/Y') }} à {{ $appointment->slot->start_time }}** avec le **Dr. {{ $appointment->slot->doctor->prenom }} {{ $appointment->slot->doctor->nom }}** est disponible.

**Montant à régler :** {{ number_format($appointment->amount_to_pay, 0, ',', ' ') }} FCFA

*Attention : vous disposez d'un délai imparti pour effectuer le règlement, après quoi le créneau sera libéré.*

@component('mail::button', ['url' => $paymentUrl])
Payer maintenant
@endcomponent

Cordialement,<br>
L'équipe {{ config('app.name') }}
@endcomponent