import { useQuery } from "@tanstack/react-query";
import { fetchPatients } from "@/lib/supabase/queries/patients";

export function usePatients() {
  return useQuery({
    queryKey: ["patients"],
    queryFn: fetchPatients,
    staleTime: 1000 * 60 * 5,
  });
}
