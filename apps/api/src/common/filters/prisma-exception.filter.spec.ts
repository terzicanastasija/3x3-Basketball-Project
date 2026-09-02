import { HttpStatus } from "@nestjs/common";
import { ArgumentsHost } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaExceptionFilter } from "./prisma-exception.filter";

function makeHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("boom", { code, clientVersion: "5.20.0", meta });
}

describe("PrismaExceptionFilter", () => {
  it("maps a foreign-key violation (P2003) to a 400 — a bad referenced ID, not a server crash", () => {
    const filter = new PrismaExceptionFilter();
    const { host, status, json } = makeHost();

    filter.catch(knownError("P2003"), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: HttpStatus.BAD_REQUEST })
    );
  });

  it("maps a missing-record error (P2025) to a 404", () => {
    const filter = new PrismaExceptionFilter();
    const { host, status } = makeHost();

    filter.catch(knownError("P2025"), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it("maps a unique-constraint violation (P2002) to a 409, naming the conflicting field", () => {
    const filter = new PrismaExceptionFilter();
    const { host, status, json } = makeHost();

    filter.catch(knownError("P2002", { target: ["email"] }), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("email") }));
  });

  it("falls back to a 500 for a Prisma error code it doesn't specifically recognize", () => {
    const filter = new PrismaExceptionFilter();
    const { host, status } = makeHost();

    filter.catch(knownError("P2099"), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
