import { useQuery } from "@tanstack/react-query";
import { getUploadAccess } from "../services/uploadAccess.service";

// Which upload programs the signed-in employee may use; null until the answer arrives.
export function useUploadAccessQuery() {
  return useQuery({ queryKey: ["docUploadAccess"], queryFn: getUploadAccess, initialData: null });
}