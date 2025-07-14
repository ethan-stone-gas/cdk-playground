import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "aws-amplify/auth";

export function useAuth() {
  return useQuery({
    queryKey: ["auth"],
    queryFn: () => getCurrentUser(),
  });
}
