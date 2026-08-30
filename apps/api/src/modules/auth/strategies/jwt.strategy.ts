import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Env } from "../../../config/env.validation";

export interface JwtAccessPayload {
  sub: string;
  email: string;
  isSuperadmin: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(configService: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get("JWT_ACCESS_SECRET", { infer: true }),
    });
  }

  validate(payload: JwtAccessPayload) {
    return {
      id: payload.sub,
      email: payload.email,
      isSuperadmin: payload.isSuperadmin,
    };
  }
}
