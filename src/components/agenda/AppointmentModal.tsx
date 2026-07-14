import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useCreateAppointment, useUpdateAppointment, useDeleteAppointment } from "@/hooks/use-appointments";
import { addMinutes, todayIso } from "@/lib/utils/date";
import type { Appointment, Patient, Service } from "@/lib/types/database";

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

  const [patientId, setPatientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [status, setStatus] = useState("agendado");
  const [date, setDate] = useState(defaultDate || todayIso());
  const [startTime, setStartTime] = useState(defaultSlot || "08:00");
  const [endTime, setEndTime] = useState("");
  const [price, setPrice] = useState("");

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId),
    [serviceId, services]
  );

  useEffect(() => {
    if (appointment) {
      setPatientId(appointment.patient_id);
      setServiceId(appointment.service_id || "");
      setStatus(appointment.status);
      setDate(appointment.appointment_date);
      setStartTime(appointment.start_time);
      setEndTime(appointment.end_time);
      setPrice(String(appointment.service_price_at_time || ""));
    } else {
      setPatientId("");
      setServiceId("");
      setStatus("agendado");
      setDate(defaultDate || todayIso());
      setStartTime(defaultSlot || "08:00");
      setEndTime("");
      setPrice("");
    }
  }, [appointment, defaultDate, defaultSlot]);

  useEffect(() => {
    if (selectedService && startTime) {
      setEndTime(addMinutes(startTime, selectedService.duration_minutes || 45));
    }
  }, [selectedService, startTime]);

  async function handleSave() {
    if (!patientId) {
      toast.warning("Selecione o paciente");
      return;
    }
    if (!serviceId) {
      toast.warning("Selecione o serviço");
      return;
    }
    if (!date) {
      toast.warning("Informe a data");
      return;
    }
    if (!startTime) {
      toast.warning("Informe o horário");
      return;
    }

    const payload = {
      patient_id: patientId,
      service_id: serviceId,
      status,
      appointment_date: date,
      start_time: startTime,
      end_time: endTime || addMinutes(startTime, selectedService?.duration_minutes || 45),
      duration_minutes: selectedService?.duration_minutes || 45,
      service_price_at_time: Number(price) || 0,
    };

    try {
      if (isEditing && appointment) {
        await updateAppt.mutateAsync({ id: appointment.id, data: payload });
        toast.success("Agendamento atualizado");
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <p className="text-xs text-muted-foreground">Agenda FEMIC</p>
            <h3 className="text-lg font-bold">
              {isEditing ? "Editar agendamento" : "Novo agendamento"}
            </h3>
          </div>
          <button
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Patient */}
          <div>
            <label className="mb-1.5 block text-sm font-bold">Paciente *</label>
            <select
              className="w-full rounded-lg border px-3 py-2.5 text-sm"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Service */}
          <div>
            <label className="mb-1.5 block text-sm font-bold">Serviço *</label>
            <select
              className="w-full rounded-lg border px-3 py-2.5 text-sm"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — R$ {Number(s.price || 0).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="mb-1.5 block text-sm font-bold">Status</label>
            <select
              className="w-full rounded-lg border px-3 py-2.5 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="agendado">Agendado</option>
              <option value="confirmado">Confirmado</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-bold">Data</label>
              <input
                type="date"
                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold">Início</label>
              <input
                type="time"
                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold">Fim</label>
              <input
                type="time"
                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                value={endTime}
                readOnly
              />
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="mb-1.5 block text-sm font-bold">
              Valor da sessão
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-lg border px-3 py-2.5 text-sm"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-6 py-4">
          <button
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
            onClick={onClose}
          >
            Cancelar
          </button>
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                onClick={handleDelete}
              >
                Remover
              </button>
            )}
            <button
              className="rounded-lg bg-primary px-6 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
              onClick={handleSave}
              disabled={createAppt.isPending || updateAppt.isPending}
            >
              {createAppt.isPending || updateAppt.isPending
                ? "Salvando..."
                : "Salvar agendamento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
