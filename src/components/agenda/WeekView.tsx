import { useMemo, useState, useEffect } from "react";
import {
  format,
  addDays,
  startOfWeek,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { fmtTime, timeToMin, fmtDate } from "@/lib/utils/date";
import { fetchScheduleSettings } from "@/lib/supabase/queries/services";
import { AppointmentCard } from "./AppointmentCard";
import { AppointmentModal } from "./AppointmentModal";
import { useQuickStatus } from "@/hooks/use-appointments";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Appointment, Patient, Service } from "@/lib/types/database";

interface WeekViewProps {
  currentDate: Date;
  appointments: Appointment[];
  patients: Patient[];
  services: Service[];
  onDateChange: (date: Date) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
}

const HOUR_HEIGHT = 72;
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const STATUS_BG: Record<string, string> = {
  agendado: "bg-amber-50 border-l-amber-400",
  confirmado: "bg-blue-50 border-l-blue-400",
  concluido: "bg-green-50 border-l-green-400 opacity-75",
  cancelado: "bg-red-50 border-l-red-400 opacity-60",
};

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return parts[0] + " " + parts[parts.length - 1][0] + ".";
}

const STORAGE_KEY = "femic_agenda_view";

export function WeekView({
  currentDate,
  appointments,
  patients,
  services,
  onDateChange,
}: WeekViewProps) {
  const [viewMode, setViewMode] = useState<"grade" | "blocos">(() => {
    return (localStorage.getItem(STORAGE_KEY) as "grade" | "blocos") || "grade";
  });

  useEffect(() => { localStorage.setItem(STORAGE_KEY, viewMode); }, [viewMode]);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [infoAppointment, setInfoAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [slotSummaryOpen, setSlotSummaryOpen] = useState(false);
  const [slotSummaryData, setSlotSummaryData] = useState<{ date: string; time: string; appointments: Appointment[] } | null>(null);
  const quickStatus = useQuickStatus();

  const { data: scheduleSettings } = useQuery({
    queryKey: ["schedule_settings"],
    queryFn: fetchScheduleSettings,
  });

  const workingDays = useMemo(() => {
    if (!scheduleSettings?.working_days) return [1, 2, 3, 4, 5, 6];
    return scheduleSettings.working_days.split(",").map(Number);
  }, [scheduleSettings]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const allDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const days = allDays.filter((d) => workingDays.includes(d.getDay()));

  const effectiveStartHour = scheduleSettings?.start_time ? parseInt(scheduleSettings.start_time.split(":")[0]) : 8;
  const effectiveEndHour = scheduleSettings?.end_time ? parseInt(scheduleSettings.end_time.split(":")[0]) : 20;
  const effectiveTotalHours = effectiveEndHour - effectiveStartHour;
  const hours = Array.from({ length: effectiveTotalHours }, (_, i) => `${String(effectiveStartHour + i).padStart(2, "0")}:00`);

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      map.set(key, appointments.filter((a) => a.appointment_date === key));
    }
    return map;
  }, [appointments, days]);

  const patientMap = useMemo(() => {
    const map = new Map<string, Patient>();
    patients.forEach((p) => map.set(p.id, p));
    return map;
  }, [patients]);

  const serviceMap = useMemo(() => {
    const map = new Map<string, Service>();
    services.forEach((s) => map.set(s.id, s));
    return map;
  }, [services]);

  // ---- Blocos helpers ----
  function getCardStyle(appt: Appointment, overlapIndex = 0, overlapCount = 1) {
    const sMin = timeToMin(appt.start_time);
    const eMin = timeToMin(appt.end_time);
    const startOff = sMin - effectiveStartHour * 60;
    const dur = Math.max(eMin - sMin, 15);
    const top = (startOff / 60) * HOUR_HEIGHT;
    const height = (dur / 60) * HOUR_HEIGHT;
    if (overlapCount > 1) {
      const w = 100 / overlapCount;
      return { top: `${top}px`, height: `${height}px`, width: `calc(${w}% - 4px)`, left: `calc(${overlapIndex * w}% + 2px)`, position: 'absolute' as const, zIndex: 10 };
    }
    return { top: `${top}px`, height: `${height}px`, width: 'calc(100% - 4px)', left: '2px', position: 'absolute' as const };
  }

  function computeOverlapLayout(dayAppts: Appointment[]) {
    const sorted = [...dayAppts].sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time));
    const groups: Appointment[][] = [];
    for (const appt of sorted) {
      const aS = timeToMin(appt.start_time), aE = timeToMin(appt.end_time);
      let placed = false;
      for (const g of groups) {
        if (g.some((x) => { const gS = timeToMin(x.start_time), gE = timeToMin(x.end_time); return aS < gE && aE > gS; })) {
          g.push(appt); placed = true; break;
        }
      }
      if (!placed) groups.push([appt]);
    }
    const map = new Map<string, { index: number; count: number }>();
    for (const g of groups) g.forEach((a, i) => map.set(a.id, { index: i, count: g.length }));
    return map;
  }

  // ---- Grade helpers ----
  function getSlotKey(hourIdx: number): string {
    return `${String(effectiveStartHour + hourIdx).padStart(2, "0")}:00`;
  }

  const appointmentsBySlot = useMemo(() => {
    const map = new Map<string, Map<string, Appointment[]>>();
    for (const day of days) {
      const dayKey = format(day, "yyyy-MM-dd");
      const hourMap = new Map<string, Appointment[]>();
      for (let i = 0; i < effectiveTotalHours; i++) {
        hourMap.set(getSlotKey(i), []);
      }
      const dayAppts = appointmentsByDay.get(dayKey) || [];
      for (const appt of dayAppts) {
        const hourKey = appt.start_time.split(":")[0] + ":00";
        const list = hourMap.get(hourKey);
        if (list) list.push(appt);
      }
      map.set(dayKey, hourMap);
    }
    return map;
  }, [appointmentsByDay, days, effectiveTotalHours, effectiveStartHour]);

  // ---- Shared handlers ----
  function handleSlotClick(day: Date, hour: number) {
    const dateStr = format(day, "yyyy-MM-dd");
    const timeStr = `${String(hour).padStart(2, "0")}:00`;
    const dayAppts = appointmentsByDay.get(dateStr) || [];
    const overlapping = dayAppts.filter((a) => {
      const aS = timeToMin(a.start_time), aE = timeToMin(a.end_time), sM = timeToMin(timeStr);
      return sM >= aS && sM < aE;
    });
    if (overlapping.length > 0) {
      setSlotSummaryData({ date: dateStr, time: timeStr, appointments: overlapping });
      setSlotSummaryOpen(true);
    } else {
      setEditingAppointment(null);
      setSelectedDate(dateStr);
      setSelectedSlot(timeStr);
      setEditModalOpen(true);
    }
  }

  function handleCardClick(appt: Appointment) { setInfoAppointment(appt); setInfoModalOpen(true); }

  function openEditFromInfo(appt: Appointment) {
    setInfoModalOpen(false);
    setEditingAppointment(appt);
    setSelectedDate(appt.appointment_date);
    setSelectedSlot(appt.start_time);
    setEditModalOpen(true);
  }

  function handleQuickStatus(id: string, status: string) { quickStatus.mutate({ id, status }); setInfoModalOpen(false); }

  function prevWeek() { const d = new Date(currentDate); d.setDate(d.getDate() - 7); onDateChange(d); }
  function nextWeek() { const d = new Date(currentDate); d.setDate(d.getDate() + 7); onDateChange(d); }
  function goToday() { onDateChange(new Date()); }

  const infoPatient = infoAppointment ? patientMap.get(infoAppointment.patient_id) : null;
  const infoService = infoAppointment?.service_id ? serviceMap.get(infoAppointment.service_id) : null;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent" onClick={goToday}>Hoje</button>
          <button className="rounded-lg border px-2 py-1.5 text-sm hover:bg-accent" onClick={prevWeek}>←</button>
          <button className="rounded-lg border px-2 py-1.5 text-sm hover:bg-accent" onClick={nextWeek}>→</button>
          <h3 className="ml-2 text-base font-bold">
            {format(weekStart, "dd MMM", { locale: ptBR })} — {days.length > 0 ? format(days[days.length - 1], "dd MMM yyyy", { locale: ptBR }) : format(weekStart, "dd MMM yyyy", { locale: ptBR })}
          </h3>
        </div>
        <div className="flex gap-1 rounded-lg border p-0.5">
          <button className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${viewMode === "grade" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setViewMode("grade")}>📋 Grade</button>
          <button className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${viewMode === "blocos" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setViewMode("blocos")}>📊 Blocos</button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border bg-card">
        <div className="grid" style={{ gridTemplateColumns: viewMode === "grade" ? `50px repeat(${days.length}, 1fr)` : `60px repeat(${days.length}, 1fr)`, gridTemplateRows: viewMode === "blocos" ? `auto repeat(${effectiveTotalHours}, ${HOUR_HEIGHT}px)` : `auto repeat(${effectiveTotalHours}, auto)` }}>
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-r bg-card" />
          {days.map((day, i) => (
            <div key={i} className="sticky top-0 z-10 border-b border-r bg-card px-2 py-2 text-center">
              <p className="text-[11px] font-medium text-muted-foreground">{DAY_NAMES[day.getDay()]}</p>
              <p className={cn("text-lg font-bold", isToday(day) && "text-femic-cyan")}>{format(day, "d")}</p>
            </div>
          ))}

          {/* Time rows */}
          {hours.map((hour, hourIndex) => (
            viewMode === "blocos" ? renderBlocosRow(hour, hourIndex) : renderGradeRow(hour, hourIndex)
          ))}
        </div>
      </div>

      {/* Legenda de cores */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-amber-100 border border-amber-300" /> Agendado</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-blue-100 border border-blue-300" /> Confirmado</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-green-100 border border-green-300" /> Concluído</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-red-100 border border-red-300" /> Cancelado</span>
      </div>

      {/* Slot Summary Dialog */}
      <Dialog open={slotSummaryOpen} onOpenChange={(open) => !open && setSlotSummaryOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div>
              <DialogDescription>Resumo do horário</DialogDescription>
              <DialogTitle>{slotSummaryData?.date ? fmtDate(slotSummaryData.date) : ""} às {slotSummaryData?.time?.slice(0, 5)}</DialogTitle>
            </div>
            <DialogClose className="rounded-lg p-2 text-muted-foreground hover:bg-accent">✕</DialogClose>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-2">
              <p className="text-sm font-bold text-muted-foreground">{slotSummaryData?.appointments.length} paciente(s) neste horário</p>
              {slotSummaryData?.appointments.map((appt) => {
                const p = patientMap.get(appt.patient_id);
                const s = serviceMap.get(appt.service_id || "");
                return (
                  <div key={appt.id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{p?.name || "—"}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        appt.status === "concluido" ? "bg-green-50 text-green-600" :
                        appt.status === "cancelado" ? "bg-red-50 text-red-600" :
                        appt.status === "confirmado" ? "bg-blue-50 text-blue-600" :
                        "bg-amber-50 text-amber-600"
                      }`}>{appt.status}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{s?.name || "—"} · {fmtTime(appt.start_time)}–{fmtTime(appt.end_time)}</p>
                  </div>
                );
              })}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotSummaryOpen(false)}>Fechar</Button>
            {slotSummaryData && (
              <Button onClick={() => { setSlotSummaryOpen(false); setEditingAppointment(null); setSelectedDate(slotSummaryData.date); setSelectedSlot(slotSummaryData.time); setEditModalOpen(true); }}>
                Agendar neste horário
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Modal */}
      <Dialog open={infoModalOpen} onOpenChange={(open) => !open && setInfoModalOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div>
              <DialogDescription>Detalhes do agendamento</DialogDescription>
              <DialogTitle>{infoPatient?.name || "Paciente"}</DialogTitle>
            </div>
            <DialogClose className="rounded-lg p-2 text-muted-foreground hover:bg-accent">✕</DialogClose>
          </DialogHeader>
          <DialogBody>
            {infoAppointment && (
              <div className="space-y-4">
                <div className={`rounded-lg border p-3 text-sm font-bold ${
                  infoAppointment.status === "agendado" ? "bg-amber-50 text-amber-800 border-amber-200" :
                  infoAppointment.status === "confirmado" ? "bg-blue-50 text-blue-800 border-blue-200" :
                  infoAppointment.status === "concluido" ? "bg-green-50 text-green-800 border-green-200" :
                  "bg-red-50 text-red-800 border-red-200 opacity-70"
                }`}>
                  {infoAppointment.status === "agendado" ? "Agendado" :
                   infoAppointment.status === "confirmado" ? "Confirmado" :
                   infoAppointment.status === "concluido" ? "Concluído" : "Cancelado"}
                </div>
                <div className="space-y-2 text-sm">
                  {infoPatient?.whatsapp && <div className="flex justify-between"><span className="text-muted-foreground">WhatsApp</span><span>{infoPatient.whatsapp}</span></div>}
                  {infoService && <div className="flex justify-between"><span className="text-muted-foreground">Serviço</span><span>{infoService.name}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span>{fmtDate(infoAppointment.appointment_date)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Horário</span><span>{fmtTime(infoAppointment.start_time)} – {fmtTime(infoAppointment.end_time)}</span></div>
                  {infoAppointment.notes && <div><span className="text-muted-foreground block mt-2">Obs</span><p className="text-sm">{infoAppointment.notes}</p></div>}
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter className="flex-wrap gap-2">
            <div className="flex flex-wrap gap-1">
              {infoAppointment && infoAppointment.status !== "agendado" && (
                <Button size="sm" variant="outline" className="text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100"
                  onClick={() => infoAppointment && handleQuickStatus(infoAppointment.id, "agendado")}>Agendado</Button>
              )}
              {infoAppointment && infoAppointment.status !== "confirmado" && (
                <Button size="sm" variant="outline" className="text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100"
                  onClick={() => infoAppointment && handleQuickStatus(infoAppointment.id, "confirmado")}>Confirmado</Button>
              )}
              {infoAppointment && infoAppointment.status !== "concluido" && (
                <Button size="sm" variant="outline" className="text-green-700 border-green-200 bg-green-50 hover:bg-green-100"
                  onClick={() => infoAppointment && handleQuickStatus(infoAppointment.id, "concluido")}>Concluir</Button>
              )}
              {infoAppointment && infoAppointment.status !== "cancelado" && (
                <Button size="sm" variant="outline" className="text-red-700 border-red-200 bg-red-50 hover:bg-red-100"
                  onClick={() => infoAppointment && handleQuickStatus(infoAppointment.id, "cancelado")}>Cancelar</Button>
              )}
            </div>
            <div className="flex gap-1 w-full justify-end">
              <Button variant="outline" size="sm" onClick={() => setInfoModalOpen(false)}>Fechar</Button>
              {infoAppointment && <Button size="sm" onClick={() => openEditFromInfo(infoAppointment)}>✏️ Editar</Button>}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppointmentModal open={editModalOpen} onClose={() => setEditModalOpen(false)} appointment={editingAppointment}
        defaultDate={selectedDate} defaultSlot={selectedSlot} patients={patients} services={services} />
    </>
  );

  // ---- Blocos Row ----
  function renderBlocosRow(hour: string, hourIndex: number) {
    return (
      <>
        <div key={`time-${hour}`} className="border-r text-right text-[11px] text-muted-foreground" style={{ paddingRight: "6px", paddingTop: "2px" }}>{hour}</div>
        {days.map((day, dayIndex) => {
          return (
            <div key={`cell-${hourIndex}-${dayIndex}`}
              className={cn("relative border-b border-r border-dashed transition-colors cursor-pointer hover:bg-accent/50", hourIndex === effectiveTotalHours - 1 && "border-b-0")}
              onClick={() => handleSlotClick(day, effectiveStartHour + hourIndex)}
            >
              {hourIndex === 0 && renderBlocosAppts(day, dayIndex)}
            </div>
          );
        })}
      </>
    );
  }

  function renderBlocosAppts(day: Date, dayIndex: number) {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayAppts = appointmentsByDay.get(dateStr) || [];
    const overlapLayout = computeOverlapLayout(dayAppts);
    return (
      <div className="absolute inset-0 pointer-events-none" style={{ gridRow: `2 / ${effectiveTotalHours + 2}`, gridColumn: dayIndex + 2 }}>
        {dayAppts.map((appt) => {
          const layout = overlapLayout.get(appt.id);
          return (
            <div key={appt.id} className="relative pointer-events-auto">
              <AppointmentCard appointment={appt} patient={patientMap.get(appt.patient_id)}
                service={serviceMap.get(appt.service_id || "")}
                style={getCardStyle(appt, layout?.index || 0, layout?.count || 1)}
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleCardClick(appt); }} />
            </div>
          );
        })}
      </div>
    );
  }

  // ---- Grade Row ----
  function renderGradeRow(hour: string, hourIndex: number) {
    return (
      <>
        <div key={`time-${hour}`} className="border-r text-right text-[11px] text-muted-foreground p-1 align-top"
          style={{ paddingRight: "6px", paddingTop: "4px" }}>{hour}</div>
        {days.map((day, dayIndex) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const slotKey = getSlotKey(hourIndex);
          const slotAppts = appointmentsBySlot.get(dateStr)?.get(slotKey) || [];
          return (
            <div key={`grade-${hourIndex}-${dayIndex}`}
              className={cn("border-b border-r border-dashed p-1 cursor-pointer hover:bg-accent/30", hourIndex === effectiveTotalHours - 1 && "border-b-0")}
              onClick={() => handleSlotClick(day, effectiveStartHour + hourIndex)}
              style={{ minHeight: "48px" }}
            >
              {slotAppts.map((appt) => {
                const p = patientMap.get(appt.patient_id);
                const s = serviceMap.get(appt.service_id || "");
                return (
                  <div key={appt.id}
                    className={`flex items-center gap-1 rounded px-1.5 py-1 mb-1 cursor-pointer text-xs leading-tight border-l-2 ${STATUS_BG[appt.status] || "bg-white border-l-gray-300"}`}
                    onClick={(e) => { e.stopPropagation(); handleCardClick(appt); }}
                  >
                    <span className="font-medium shrink-0 text-[11px]">{fmtTime(appt.start_time)}</span>
                    <span className="truncate font-bold text-[12px]">{shortName(p?.name || "?")}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </>
    );
  }
}