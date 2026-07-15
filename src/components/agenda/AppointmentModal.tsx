import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCreateAppointment, useUpdateAppointment, useDeleteAppointment } from "@/hooks/use-appointments";
import { fetchPatientActivePackage } from "@/lib/supabase/queries/appointments";
import { addMinutes, todayIso } from "@/lib/utils/date";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Appointment, Patient, Service } from "@/lib/types/database";

const appointmentSchema = z.object({
  patient_id: z.string().min(1, "Selecione o paciente"),
  service_id: z.string().min(1, "Selecione o serviço"),
  status: z.enum(["agendado", "confirmado", "concluido", "cancelado"]),
  appointment_date: z.string().min(1, "Informe a data"),
  start_time: z.string().min(1, "Informe o horário"),
  end_time: z.string(),
  service_price_at_time: z.preprocess((v) => Number(v) || 0, z.number().min(0)),
  notes: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentModalProps {
  open: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  defaultDate: string;
  defaultSlot: string;
  patients: Patient[];
  services: Service[];
}

export function AppointmentModal({
  open,
  onClose,
  appointment,
  defaultDate,
  defaultSlot,
  patients,
  services,
}: AppointmentModalProps) {
  const isEditing = !!appointment;
  const createAppt = useCreateAppointment();
  const updateAppt = useUpdateAppointment();
  const deleteAppt = useDeleteAppointment();
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringCount, setRecurringCount] = useState(6);
  const [recurringDays, setRecurringDays] = useState<number[]>([1, 3]); // seg, qua

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patient_id: "",
      service_id: "",
      status: "agendado",
      appointment_date: defaultDate || todayIso(),
      start_time: defaultSlot || "08:00",
      end_time: "",
      service_price_at_time: 0,
      notes: "",
    },
  });

  const watchedPatientId = form.watch("patient_id");
  const watchedServiceId = form.watch("service_id");
  const watchedStartTime = form.watch("start_time");
  const watchedStatus = form.watch("status");

  const { data: activePackage } = useQuery({
    queryKey: ["active_package", watchedPatientId],
    queryFn: () => fetchPatientActivePackage(watchedPatientId),
    enabled: !!watchedPatientId,
  });

  const selectedService = useMemo(
    () => services.find((s) => s.id === watchedServiceId),
    [services, watchedServiceId]
  );

  useEffect(() => {
    const service = services.find((s) => s.id === watchedServiceId);
    if (service && watchedStartTime) {
      form.setValue("end_time", addMinutes(watchedStartTime, service.duration_minutes || 45));
    }
  }, [watchedServiceId, watchedStartTime, services]);

  useEffect(() => {
    if (appointment) {
      form.reset({
        patient_id: appointment.patient_id,
        service_id: appointment.service_id || "",
        status: appointment.status as AppointmentFormData["status"],
        appointment_date: appointment.appointment_date,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        service_price_at_time: appointment.service_price_at_time ?? 0,
        notes: appointment.notes || "",
      });
    } else {
      form.reset({
        patient_id: "",
        service_id: "",
        status: "agendado",
        appointment_date: defaultDate || todayIso(),
        start_time: defaultSlot || "08:00",
        end_time: "",
        service_price_at_time: 0,
        notes: "",
      });
    }
  }, [appointment, defaultDate, defaultSlot, form]);

  const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  function toggleDay(day: number) {
    setRecurringDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function getNextDates(startDate: string, daysOfWeek: number[], count: number): string[] {
    const dates: string[] = [];
    const current = new Date(startDate + "T00:00:00");
    while (dates.length < count) {
      const dow = current.getDay();
      if (daysOfWeek.includes(dow)) {
        dates.push(current.toISOString().slice(0, 10));
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  async function handleSave(data: AppointmentFormData) {
    try {
      const payload = {
        ...data,
        end_time: data.end_time || addMinutes(data.start_time, selectedService?.duration_minutes || 45),
        duration_minutes: selectedService?.duration_minutes || 45,
      };

      if (isEditing && appointment) {
        await updateAppt.mutateAsync({ id: appointment.id, data: payload });
        toast.success("Agendamento atualizado");
      } else if (isRecurring && !isEditing) {
        const dates = getNextDates(data.appointment_date, recurringDays, recurringCount);
        for (const date of dates) {
          await createAppt.mutateAsync({ ...payload, appointment_date: date });
        }
        toast.success(`${dates.length} agendamentos criados`);
      } else {
        await createAppt.mutateAsync(payload);
        toast.success("Agendamento criado");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    }
  }

  async function handleDelete() {
    if (!appointment) return;
    if (!confirm("Remover este agendamento?")) return;
    try {
      await deleteAppt.mutateAsync(appointment.id);
      toast.success("Agendamento removido");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogDescription>Agenda FEMIC</DialogDescription>
            <DialogTitle>{isEditing ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
          </div>
          <DialogClose className="rounded-lg p-2 text-muted-foreground hover:bg-accent">
            ✕
          </DialogClose>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSave)}>
          <DialogBody>
            <div>
              <Label className="mb-1.5 block">Paciente *</Label>
              <select
                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                {...form.register("patient_id")}
              >
                <option value="">Selecione...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {form.formState.errors.patient_id && (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.patient_id.message}</p>
              )}
            </div>

            {activePackage && (
              <div className={`rounded-lg p-3 text-sm ${watchedStatus === "concluido" ? "bg-green-50" : "bg-blue-50"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-800">Pacote ativo</span>
                  <span className="text-lg font-black text-blue-900">{activePackage.remaining_sessions}</span>
                </div>
                <p className="text-xs text-blue-700 mt-0.5">
                  {activePackage.remaining_sessions} sessão(ns) restante(s)
                  {watchedStatus === "concluido" && " — será consumida 1 sessão"}
                </p>
              </div>
            )}

            <div>
              <Label className="mb-1.5 block">Serviço *</Label>
              <select
                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                {...form.register("service_id")}
              >
                <option value="">Selecione...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — R$ {Number(s.price || 0).toFixed(2)}
                  </option>
                ))}
              </select>
              {form.formState.errors.service_id && (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.service_id.message}</p>
              )}
            </div>

            <div>
              <Label className="mb-1.5 block">Status</Label>
              <select
                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                {...form.register("status")}
              >
                <option value="agendado">Agendado</option>
                <option value="confirmado">Confirmado</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="mb-1.5 block">Data</Label>
                <input
                  type="date"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                  {...form.register("appointment_date")}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Início</Label>
                <input
                  type="time"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                  {...form.register("start_time")}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Fim</Label>
                <input
                  type="time"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                  {...form.register("end_time")}
                  readOnly
                />
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">Observações</Label>
              <textarea
                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                rows={2}
                placeholder="Anotações sobre este agendamento..."
                {...form.register("notes")}
              />
            </div>

            {!isEditing && (
              <div className="rounded-lg border p-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)}
                    className="rounded border-gray-300" />
                  <span className="text-sm font-bold">Agendamento recorrente</span>
                </label>
                {isRecurring && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-muted-foreground">Dias da semana</label>
                      <div className="flex gap-1">
                        {DAYS.map((dayName, i) => (
                          <button key={i} type="button"
                            className={`rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                              recurringDays.includes(i)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-accent"
                            }`}
                            onClick={() => toggleDay(i)}
                          >
                            {dayName}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-muted-foreground">Nº de sessões</label>
                      <input type="number" min={1} max={30}
                        className="w-24 rounded-lg border px-3 py-1.5 text-sm"
                        value={recurringCount}
                        onChange={(e) => setRecurringCount(parseInt(e.target.value) || 6)} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="mb-1.5 block">Valor da sessão</Label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                {...form.register("service_price_at_time")}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <div className="flex items-center gap-2">
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                >
                  Remover
                </Button>
              )}
              <Button type="submit" disabled={createAppt.isPending || updateAppt.isPending}>
                {createAppt.isPending || updateAppt.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
