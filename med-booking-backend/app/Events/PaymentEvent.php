<?php

namespace App\Events;

use App\Models\Payment;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PaymentEvent
{
    use Dispatchable, SerializesModels;

    public Payment $payment;
    public string $action; // 'success', 'failed', 'link_generated', 'refunded'

    public function __construct(Payment $payment, string $action)
    {
        $this->payment = $payment;
        $this->action = $action;
    }
}