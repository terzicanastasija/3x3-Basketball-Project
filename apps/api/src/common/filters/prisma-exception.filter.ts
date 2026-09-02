import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { Prisma } from "@prisma/client";

// Catches raw Prisma errors that would otherwise leak straight through as an opaque 500 —
// most commonly a client-supplied ID that doesn't reference a real row (P2003 on create,
// P2025 on update/delete) or a duplicate unique value (P2002). This is deliberately generic:
// a case worth a specific, friendly message (e.g. "Player is not on this roster") should get
// an explicit check in its service instead, ahead of the Prisma call — this filter is the
// fallback for every FK/uniqueness case that isn't worth writing out one-by-one.
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, message } = mapPrismaError(exception);
    response.status(status).json({ statusCode: status, message });
  }
}

function mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): { status: number; message: string } {
  switch (exception.code) {
    case "P2003":
      return { status: HttpStatus.BAD_REQUEST, message: "One or more referenced records do not exist." };
    case "P2025":
      return { status: HttpStatus.NOT_FOUND, message: "Record not found." };
    case "P2002": {
      const target = Array.isArray(exception.meta?.target) ? exception.meta.target.join(", ") : "field";
      return { status: HttpStatus.CONFLICT, message: `A record with this ${target} already exists.` };
    }
    default:
      return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: "Internal server error" };
  }
}
