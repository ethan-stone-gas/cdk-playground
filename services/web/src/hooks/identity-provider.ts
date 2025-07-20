import { useMutation } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL;

export function useGetIdentityProviderForEmail() {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch(
        `${API_URL}/identity-provider-for-email?email=${encodeURIComponent(
          email
        )}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error("Failed to get identity provider for email");
      }

      const data = await response.json();

      return data as {
        identityProviderName: string;
      };
    },
  });
}
