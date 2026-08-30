import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { loginSchema, LoginDto } from "@3x3/shared";
import { useLogin } from "../api";
import { ApiError } from "../../../lib/api-client";
import { LanguageSwitcher } from "../../../components/LanguageSwitcher";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginDto>({ resolver: zodResolver(loginSchema) });

  const onSubmit = (dto: LoginDto) => {
    login.mutate(dto, { onSuccess: () => navigate("/") });
  };

  return (
    <div style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <LanguageSwitcher />
      </div>
      <h1>{t("auth.login.title")}</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div style={{ marginBottom: 12 }}>
          <label>
            {t("auth.login.email")}
            <input type="email" {...register("email")} style={{ display: "block", width: "100%" }} />
          </label>
          {errors.email && <span style={{ color: "red" }}>{errors.email.message}</span>}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>
            {t("auth.login.password")}
            <input
              type="password"
              {...register("password")}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          {errors.password && <span style={{ color: "red" }}>{errors.password.message}</span>}
        </div>
        {login.isError && (
          <p style={{ color: "red" }}>
            {login.error instanceof ApiError ? login.error.message : t("auth.login.error")}
          </p>
        )}
        <button type="submit" disabled={login.isPending}>
          {t("auth.login.submit")}
        </button>
      </form>
    </div>
  );
}
