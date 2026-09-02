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
    <div className="page page-narrow">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <LanguageSwitcher />
      </div>
      <div className="app-nav__mark" style={{ color: "var(--ink)", marginBottom: 4 }}>
        3<em>x</em>3
      </div>
      <h1>{t("auth.login.title")}</h1>
      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ marginBottom: 12 }}>
            <label>
              {t("auth.login.email")}
              <input type="email" {...register("email")} />
            </label>
            {errors.email && <span className="field-error">{errors.email.message}</span>}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>
              {t("auth.login.password")}
              <input type="password" {...register("password")} />
            </label>
            {errors.password && <span className="field-error">{errors.password.message}</span>}
          </div>
          {login.isError && (
            <p className="field-error">
              {login.error instanceof ApiError ? login.error.message : t("auth.login.error")}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={login.isPending}>
            {t("auth.login.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
