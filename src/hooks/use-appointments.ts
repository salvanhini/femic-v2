import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  quickUpdateStatus,
} from "@/lib/supabase/queries/appointments";
import { weekStart, weekEnd } from "@/lib/utils/date";

export function useAppointments(date: Date = new Date()) {
  const from = weekStart(date);
  const to = weekEnd(date);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  return useQuery({
    queryKey: ["appointments", fromStr, toStr],
    queryFn: () => fetchAppointments(fromStr, toStr),
  });
}

export function useMonthAppointments(year: number, month: number) {
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const to = new Date(year, month + 1, 0).toISOString().slice(0, 10);

  return useQuery({
    queryKey: ["appointments", from, to],
    queryFn: () => fetchAppointments(from, to),
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["session_packages"] });
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Parameters<typeof updateAppointment>[1]> }) =>
      updateAppointment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["session_packages"] });
    },
  });
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

export function useQuickStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      quickUpdateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}
