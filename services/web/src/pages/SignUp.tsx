import { signUp } from "aws-amplify/auth";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

type SignUpForm = {
  email: string;
  password: string;
};

export function SignUp() {
  const { register, handleSubmit } = useForm<SignUpForm>();
  const navigate = useNavigate();

  const onSubmit = async (data: SignUpForm) => {
    const result = await signUp({
      username: data.email,
      password: data.password,
      options: {
        userAttributes: {
          email: data.email,
        },
      },
    });

    if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
      navigate(`/confirm-sign-up?email=${data.email}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-2xl font-bold">Sign Up</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <input
          className="border border-gray-300 rounded-md p-2"
          type="text"
          placeholder="Email"
          {...register("email")}
        />
        <input
          className="border border-gray-300 rounded-md p-2"
          type="password"
          placeholder="Password"
          {...register("password")}
        />
        <button className="bg-blue-500 text-white rounded-md p-2" type="submit">
          Sign Up
        </button>
      </form>
    </div>
  );
}
