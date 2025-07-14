import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchAuthSession } from "aws-amplify/auth";

const API_URL = import.meta.env.VITE_API_URL;

export function useCreateDomainVerification() {
  return useMutation({
    mutationFn: async (domain: string) => {
      const auth = await fetchAuthSession();

      const response = await fetch(`${API_URL}/configure-domain`, {
        method: "POST",
        body: JSON.stringify({ domain }),
        headers: {
          Authorization: `${auth.tokens?.accessToken.toString()}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to create domain verification");
      }

      const data = await response.json();

      return data as {
        recordName: string;
        recordValue: string;
      };
    },
  });
}

export function useGetDomainConfiguration() {
  return useQuery({
    queryKey: ["domain-configuration"],
    queryFn: async () => {
      const auth = await fetchAuthSession();

      const response = await fetch(`${API_URL}/domain-configuration`, {
        method: "GET",
        headers: {
          Authorization: `${auth.tokens?.accessToken.toString()}`,
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error("Failed to get domain configuration");
      }

      const data = await response.json();

      return data as {
        recordName: string;
        recordValue: string;
        verified: boolean;
      };
    },
  });
}
