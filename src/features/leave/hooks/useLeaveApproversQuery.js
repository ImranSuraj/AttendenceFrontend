import { useQuery } from "@tanstack/react-query";
import { getMyApprovers } from "../services/leaveApprovers.service";

export function useMyApproversQuery() {
  return useQuery({
    queryKey: ["myApprovers"],
    queryFn: getMyApprovers,
    initialData: [],
  });
}
