import { useQuery } from "@tanstack/react-query";
import { fetchServices, fetchHealthInsurances } from "@/lib/supabase/queries/services";

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
    staleTime: 1000 * 60 * 5,
  });
}

export function useHealthInsurances() {
  return useQuery({
    queryKey: ["health_insurances"],
    queryFn: fetchHealthInsurances,
    staleTime: 1000 * 60 * 5,
  });
}
