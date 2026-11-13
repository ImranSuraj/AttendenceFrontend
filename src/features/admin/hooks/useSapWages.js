import { useQuery } from "@tanstack/react-query";
import { getSapCategories, getSapPlants } from "../services/sapWages.service";

export function useSapPlantsQuery() {
  return useQuery({ queryKey: ["admin", "sap", "plants"], queryFn: getSapPlants });
}

export function useSapCategoriesQuery() {
  return useQuery({ queryKey: ["admin", "sap", "categories"], queryFn: getSapCategories });
}

// One of the two wage files; load is that report's service function.
export function useSapReportQuery({ type, from, to, plant, category, ready, load }) {
  return useQuery({
    queryKey: ["admin", "sap", type, from, to, plant, category], enabled: ready,
    queryFn: () => load({ from, to, plant, category }),
  });
}