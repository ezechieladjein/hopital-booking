<?php
namespace App\Console\Commands;

use App\Models\Appointment;
use App\Mail\AppointmentReminderMail;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;

class SendAppointmentReminders extends Command
{
    protected $signature = 'appointments:send-reminders';
    protected $description = 'Envoie un rappel par e-mail 24h avant la consultation';

    public function handle()
    {
        $startWindow = Carbon::now()->addHours(23);
        $endWindow = Carbon::now()->addHours(25);

        $appointments = Appointment::with(['patient', 'slot.doctor.user', 'slot.doctor.speciality'])
            ->where('status', 'CONFIRME')
            ->whereNull('reminder_sent_at')
            ->whereHas('slot', function ($query) use ($startWindow, $endWindow) {
                $query->whereBetween('date_consultation', [$startWindow, $endWindow]);
            })
            ->get();

        $count = 0;
        foreach ($appointments as $appointment) {
            if ($appointment->patient && $appointment->patient->email) {
                Mail::to($appointment->patient->email)->send(new AppointmentReminderMail($appointment));
                $appointment->update(['reminder_sent_at' => Carbon::now()]);
                $count++;
            }
        }

        $this->info("{$count} mail(s) de rappel envoyé(s) avec succès.");
    }
}