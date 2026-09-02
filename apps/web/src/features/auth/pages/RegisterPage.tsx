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
      <div className="page page-narrow">
        <p className="field-error">{t("register.missingToken")}</p>
      </div>
    );
  }

  return (
    <div className="page page-narrow">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <LanguageSwitcher />
      </div>
      <h1>{t("register.title")}</h1>
      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ marginBottom: 12 }}>
            <label>
              {t("register.firstName")}
              <input {...register("firstName")} />
            </label>
            {errors.firstName && <span className="field-error">{errors.firstName.message}</span>}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>
              {t("register.lastName")}
              <input {...register("lastName")} />
            </label>
            {errors.lastName && <span className="field-error">{errors.lastName.message}</span>}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>
              {t("register.password")}
              <input type="password" {...register("password")} />
            </label>
            {errors.password && <span className="field-error">{errors.password.message}</span>}
          </div>
          {acceptInvite.isError && (
            <p className="field-error">
              {acceptInvite.error instanceof ApiError ? acceptInvite.error.message : t("register.error")}
            </p>
          )}
          {acceptInvite.isSuccess && <p>{t("register.success")}</p>}
          <button type="submit" className="btn-primary" disabled={acceptInvite.isPending}>
            {t("register.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
