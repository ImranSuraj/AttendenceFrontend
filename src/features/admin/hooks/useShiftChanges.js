import { useQuery } from "@tanstack/react-query";
import { getShifts } from "../services/shiftChanges.service";

export function useShiftsQuery() {
  return useQuery({ queryKey: ["admin", "shifts"], queryFn: getShifts });
}