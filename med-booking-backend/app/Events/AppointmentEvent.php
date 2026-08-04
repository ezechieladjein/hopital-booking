<?php

namespace App\Events;

use App\Models\Appointment;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AppointmentEvent
{
    use Dispatchable, SerializesModels;

    public Appointment $appointment;
    public string $action; // 'created', 'updated', 'cancelled', 'validated', 'refused'

    public function __construct(Appointment $appointment, string $action)
    {
        $this->appointment = $appointment;
        $this->action = $action;
    }
}