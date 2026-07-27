@component('mail::message')
# Confirmation de remboursement

Bonjour **{{ $appointment->patient->prenom }} {{ $appointment->patient->nom }}**,

Un remboursement d'un montant de **{{ number_format($amount, 0, ',', ' ') }} FCFA** a été exécuté concernant votre rendez-vous du **{{ \Carbon\Carbon::parse($appointment->slot->date_consultation)->format('d/m/Y') }} à {{ $appointment->slot->start_time }}**.

Le crédit apparaîtra sur votre compte selon les délais habituels de votre opérateur/banque.

Cordialement,<br>
L'équipe {{ config('app.name') }}
@endcomponent