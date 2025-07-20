import { signIn, signInWithRedirect } from "aws-amplify/auth";
import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useGetIdentityProviderForEmail } from "../hooks/identity-provider";

type SignInForm = {
  email: string;
  password: string;
};

export function SignIn() {
  const navigate = useNavigate();
  const { register, handleSubmit, watch, setValue } = useForm<SignInForm>();
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [isCheckingIdp, setIsCheckingIdp] = useState(false);

  const { mutateAsync: getIdentityProviderForEmail } =
    useGetIdentityProviderForEmail();

  const email = watch("email");

  const handleCheckIdentityProvider = useCallback(async () => {
    if (!email || !email.includes("@")) {
      return;
    }

    setIsCheckingIdp(true);

    try {
      const idp = await getIdentityProviderForEmail(email);

      if (idp) {
        // For now, just log the identity provider
        console.log("Found identity provider:", idp.identityProviderName);
        // TODO: Handle SSO flow

        await signInWithRedirect({
          provider: {
            custom: idp.identityProviderName,
          },
        });
      } else {
        // No identity provider found, show password input
        setShowPasswordInput(true);
      }
    } catch (error) {
      console.error("Error checking identity provider:", error);
      // On error, show password input as fallback
      setShowPasswordInput(true);
    } finally {
      setIsCheckingIdp(false);
    }
  }, [email, getIdentityProviderForEmail]);

  const onSubmit = async (data: SignInForm) => {
    const result = await signIn({
      username: data.email,
      password: data.password,
    });

    if (result.isSignedIn) {
      navigate("/home");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Sign In</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <input
          className="border border-gray-300 rounded-md p-2"
          type="email"
          placeholder="Email"
          {...register("email")}
        />

        {!showPasswordInput && (
          <button
            type="button"
            className="bg-blue-500 text-white rounded-md p-2 cursor-pointer"
            onClick={handleCheckIdentityProvider}
            disabled={isCheckingIdp || !email || !email.includes("@")}
          >
            {isCheckingIdp ? "Checking..." : "Continue"}
          </button>
        )}

        {isCheckingIdp && (
          <div className="text-sm text-gray-600">
            Checking identity provider...
          </div>
        )}

        {showPasswordInput && (
          <>
            <input
              className="border border-gray-300 rounded-md p-2"
              type="password"
              placeholder="Password"
              {...register("password")}
            />
            <button
              className="bg-blue-500 text-white rounded-md p-2 cursor-pointer"
              type="submit"
            >
              Sign In
            </button>
          </>
        )}
      </form>
    </div>
  );
}
