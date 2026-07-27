@component('mail::message')
# Échec du paiement

Bonjour **{{ $appointment->patient->prenom }} {{ $appointment->patient->nom }}**,

Votre tentative de paiement pour le rendez-vous du **{{ \Carbon\Carbon::parse($appointment->slot->date_consultation)->format('d/m/Y') }} à {{ $appointment->slot->start_time }}** n'a pas pu aboutir.

Aucun montant n'a été débité. Vous pouvez réessayer avant l'expiration de votre demande.

@component('mail::button', ['url' => $paymentUrl])
Réessayer le paiement
@endcomponent

Cordialement,<br>
L'équipe {{ config('app.name') }}
@endcomponent