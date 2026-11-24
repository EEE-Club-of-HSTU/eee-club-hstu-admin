import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase";
import { CERTIFICATE_STATUSES, type CertificateStatus } from "./types";

export const CERTIFICATE_ID_REGEX = /^[A-Z0-9][A-Z0-9-]{2,63}$/;

export type CertificateIdValidationResult =
  | { ok: true; certId: string }
  | { ok: false; certId: string; error: string };

/** Normalizes a certificate ID to uppercase and validates it against the allowed pattern. */
export function validateCertificateId(raw: unknown): CertificateIdValidationResult {
  const certId = String(raw ?? "").trim().toUpperCase();
  if (!certId) {
    return { ok: false, certId, error: "Certificate ID is required." };
  }
  if (!CERTIFICATE_ID_REGEX.test(certId)) {
    return {
      ok: false,
      certId,
      error:
        "Certificate ID must be 3–64 chars (A–Z, 0–9, '-'), starting with A–Z or 0–9 (no spaces, '.', '/', '#', or '?').",
    };
  }
  return { ok: true, certId };
}

export interface ValidatedCertificateData {
  type: string;
  name: string;
  details: string;
  issuedOn: string;
  status: CertificateStatus;
}

export type CertificateFieldsValidationResult =
  | { ok: true; data: ValidatedCertificateData }
  | { ok: false; errors: string[] };

/** Validates certificate payload fields to match Firestore validCertificate rules. */
export function validateCertificateFields(input: {
  type: unknown;
  name: unknown;
  details: unknown;
  issuedOn: unknown;
  status: unknown;
}): CertificateFieldsValidationResult {
  const type = String(input.type ?? "").trim();
  const name = String(input.name ?? "").trim();
  const details = String(input.details ?? "").trim();
  const issuedOn = String(input.issuedOn ?? "").trim();
  const statusRaw = String(input.status ?? "").trim().toLowerCase();

  const errors: string[] = [];
  if (!type) {
    errors.push("missing type");
  } else if (type.length > 120) {
    errors.push("type must be 120 characters or fewer");
  }
  if (!name) {
    errors.push("missing name");
  } else if (name.length > 160) {
    errors.push("name must be 160 characters or fewer");
  }
  if (!details) {
    errors.push("missing details");
  } else if (details.length > 300) {
    errors.push("details must be 300 characters or fewer");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issuedOn)) {
    errors.push("issuedOn must be YYYY-MM-DD");
  }
  if (!CERTIFICATE_STATUSES.includes(statusRaw as CertificateStatus)) {
    errors.push("status must be valid or revoked");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      type,
      name,
      details,
      issuedOn,
      status: statusRaw as CertificateStatus,
    },
  };
}

export interface CreateCertificatePayload extends ValidatedCertificateData {
  createdAt: number;
  updatedAt: number;
}

export type CreateCertificateOutcome =
  | { outcome: "created"; certId: string }
  | { outcome: "exists"; certId: string };

/** Atomically creates a certificate in a Firestore transaction only if the document does not already exist. */
export async function createCertificateIfAbsent(
  rawCertId: string,
  data: CreateCertificatePayload
): Promise<CreateCertificateOutcome> {
  const idCheck = validateCertificateId(rawCertId);
  if (!idCheck.ok) {
    throw new Error(idCheck.error);
  }

  const ref = doc(db, "certificates", idCheck.certId);
  const created = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      return false;
    }
    tx.set(ref, {
      type: data.type,
      name: data.name,
      details: data.details,
      issuedOn: data.issuedOn,
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
    return true;
  });

  return {
    outcome: created ? "created" : "exists",
    certId: idCheck.certId,
  };
}
