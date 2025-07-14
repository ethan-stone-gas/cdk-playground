import { useForm } from "react-hook-form";
import { useConfigureSSO } from "../hooks/sso";

type ConfigureSSOForm = {
  providerType: "OIDC";
  issuer: string;
  clientId: string;
  clientSecret: string;
};

export function ConfigureSSO() {
  const { register, handleSubmit } = useForm<ConfigureSSOForm>();

  const { mutateAsync: configureSSO } = useConfigureSSO();

  const onSubmit = async (data: ConfigureSSOForm) => {
    await configureSSO({
      providerType: "OIDC",
      issuer: data.issuer,
      clientId: data.clientId,
      clientSecret: data.clientSecret,
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Configure SSO</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <input
          className="border border-gray-300 rounded-md p-2"
          type="text"
          placeholder="Issuer Url"
          {...register("issuer")}
        />
        <input
          className="border border-gray-300 rounded-md p-2"
          type="text"
          placeholder="Client ID"
          {...register("clientId")}
        />
        <input
          className="border border-gray-300 rounded-md p-2"
          type="text"
          placeholder="Client Secret"
          {...register("clientSecret")}
        />
        <button
          className="cursor-pointer bg-blue-500 text-white rounded-md p-2"
          type="submit"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
