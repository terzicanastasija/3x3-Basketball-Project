import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { useAcceptInvite } from "../api";
import { ApiError } from "../../../lib/api-client";
import { LanguageSwitcher } from "../../../components/LanguageSwitcher";

const registerFormSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8),
});
type RegisterFormValues = z.infer<typeof registerFormSchema>;

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const acceptInvite = useAcceptInvite();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerFormSchema) });

  const onSubmit = (values: RegisterFormValues) => {
    acceptInvite.mutate(
      { ...values, token },
      { onSuccess: () => navigate("/login") }
    );
  };

  if (!token) {
    return (
      <div style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
        <p style={{ color: "red" }}>{t("register.missingToken")}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <LanguageSwitcher />
      </div>
      <h1>{t("register.title")}</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div style={{ marginBottom: 12 }}>
          <label>
            {t("register.firstName")}
            <input {...register("firstName")} style={{ display: "block", width: "100%" }} />
          </label>
          {errors.firstName && <span style={{ color: "red" }}>{errors.firstName.message}</span>}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>
            {t("register.lastName")}
            <input {...register("lastName")} style={{ display: "block", width: "100%" }} />
          </label>
          {errors.lastName && <span style={{ color: "red" }}>{errors.lastName.message}</span>}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>
            {t("register.password")}
            <input
              type="password"
              {...register("password")}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          {errors.password && <span style={{ color: "red" }}>{errors.password.message}</span>}
        </div>
        {acceptInvite.isError && (
          <p style={{ color: "red" }}>
            {acceptInvite.error instanceof ApiError ? acceptInvite.error.message : t("register.error")}
          </p>
        )}
        {acceptInvite.isSuccess && <p>{t("register.success")}</p>}
        <button type="submit" disabled={acceptInvite.isPending}>
          {t("register.submit")}
        </button>
      </form>
    </div>
  );
}
