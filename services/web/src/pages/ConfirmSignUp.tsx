import { confirmSignUp, resendSignUpCode } from "aws-amplify/auth";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";

type ConfirmSignUpForm = {
  code: string;
};

export function ConfirmSignUp() {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const email = searchParams.get("email");

  const { register, handleSubmit } = useForm<ConfirmSignUpForm>();

  async function onSubmit(data: ConfirmSignUpForm) {
    const result = await confirmSignUp({
      username: email!,
      confirmationCode: data.code,
    });

    if (result.nextStep.signUpStep === "DONE") {
      navigate("/signin");
    }
  }

  async function onResendCode() {
    await resendSignUpCode({
      username: email!,
    });
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Confirm Sign Up</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <input
          className="border border-gray-300 rounded-md p-2"
          type="text"
          placeholder="Code"
          {...register("code")}
        />
        <button className="bg-blue-500 text-white rounded-md p-2" type="submit">
          Confirm
        </button>
        <button
          className="bg-blue-500 text-white rounded-md p-2"
          type="button"
          onClick={onResendCode}
        >
          Resend Code
        </button>
      </form>
    </div>
  );
}
