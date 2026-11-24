"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import Papa from "papaparse";
import { db } from "@/lib/firebase";
import {
  getDhakaTodayDate,
  getErrorMessage,
  sortByCreatedAtDesc,
} from "@/lib/format";
import {
  createCertificateIfAbsent,
  validateCertificateFields,
  validateCertificateId,
} from "@/lib/certificates";
import {
  CERTIFICATE_STATUSES,
  type Certificate,
  type CertificateStatus,
} from "@/lib/types";
import { ModalDialog } from "@/components/modal-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Award,
  Download,
  Edit2,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";

interface CertFormState {
  certId: string;
  type: string;
  name: string;
  details: string;
  issuedOn: string;
  status: CertificateStatus;
}

const createEmptyForm = (): CertFormState => ({
  certId: "",
  type: "Certificate of Achievement",
  name: "",
  details: "",
  issuedOn: getDhakaTodayDate(),
  status: "valid",
});

interface ParsedCsvRow {
  rowNumber: number;
  certId: string;
  type: string;
  name: string;
  details: string;
  issuedOn: string;
  status: CertificateStatus | "";
  validity: "valid" | "duplicate" | "invalid" | "imported" | "error";
  reason?: string;
}

export default function CertificatesPage() {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CertFormState>(createEmptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<ParsedCsvRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Certificate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "certificates"));
      setCerts(
        sortByCreatedAtDesc(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Certificate))
        )
      );
    } catch (err) {
      setError(
        getErrorMessage(err, "Failed to load certificates. Check database permissions.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return certs;
    return certs.filter(
      (c) =>
        String(c.id ?? "").toLowerCase().includes(q) ||
        String(c.name ?? "").toLowerCase().includes(q) ||
        String(c.type ?? "").toLowerCase().includes(q) ||
        String(c.details ?? "").toLowerCase().includes(q)
    );
  }, [certs, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(createEmptyForm());
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (cert: Certificate) => {
    setEditingId(cert.id);
    setForm({
      certId: String(cert.id ?? ""),
      type: String(cert.type ?? ""),
      name: String(cert.name ?? ""),
      details: String(cert.details ?? ""),
      issuedOn: String(cert.issuedOn ?? ""),
      status: cert.status === "revoked" ? "revoked" : "valid",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const fieldCheck = validateCertificateFields(form);
    if (!fieldCheck.ok) {
      setFormError(fieldCheck.errors.join("; "));
      return;
    }

    const now = Date.now();

    if (editingId) {
      setSaving(true);
      try {
        await updateDoc(doc(db, "certificates", editingId), {
          ...fieldCheck.data,
          updatedAt: now,
        });
        setModalOpen(false);
        await fetchCertificates();
      } catch (err) {
        setFormError(getErrorMessage(err, "Failed to update certificate."));
      } finally {
        setSaving(false);
      }
      return;
    }

    const idCheck = validateCertificateId(form.certId);
    if (!idCheck.ok) {
      setFormError(idCheck.error);
      return;
    }

    setSaving(true);
    try {
      const result = await createCertificateIfAbsent(idCheck.certId, {
        ...fieldCheck.data,
        createdAt: now,
        updatedAt: now,
      });
      if (result.outcome === "exists") {
        setFormError(
          `Certificate "${result.certId}" already exists. Overwriting existing IDs is disabled.`
        );
        return;
      }
      setModalOpen(false);
      await fetchCertificates();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to create certificate."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (cert: Certificate) => {
    const nextStatus: CertificateStatus =
      cert.status === "valid" ? "revoked" : "valid";
    const fieldCheck = validateCertificateFields({
      type: cert.type,
      name: cert.name,
      details: cert.details,
      issuedOn: cert.issuedOn,
      status: nextStatus,
    });
    if (!fieldCheck.ok) {
      setError(`Cannot update certificate "${cert.id}": ${fieldCheck.errors.join("; ")}`);
      return;
    }

    const updatedAt = Date.now();
    try {
      await updateDoc(doc(db, "certificates", cert.id), {
        ...fieldCheck.data,
        updatedAt,
      });
      setCerts((prev) =>
        prev.map((c) =>
          c.id === cert.id ? { ...c, ...fieldCheck.data, updatedAt } : c
        )
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update certificate status."));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "certificates", deleteTarget.id));
      setCerts((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete certificate."));
    } finally {
      setDeleting(false);
    }
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImportError(null);
    setImportSummary(null);
    setCsvRows([]);
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields || [];
        const requiredCols = [
          "certId",
          "type",
          "name",
          "details",
          "issuedOn",
          "status",
        ];
        const missing = requiredCols.filter((c) => !fields.includes(c));
        if (missing.length > 0) {
          setImportError(`Missing CSV columns: ${missing.join(", ")}`);
          return;
        }

        const seenInCsv = new Set<string>();

        const parsed: ParsedCsvRow[] = results.data.map((raw, idx) => {
          const idCheck = validateCertificateId(raw.certId);
          const certId = idCheck.certId;
          const type = String(raw.type ?? "").trim();
          const name = String(raw.name ?? "").trim();
          const details = String(raw.details ?? "").trim();
          const issuedOn = String(raw.issuedOn ?? "").trim();
          const statusRaw = String(raw.status ?? "").trim().toLowerCase();
          const status: CertificateStatus | "" =
            statusRaw === "valid" || statusRaw === "revoked"
              ? (statusRaw as CertificateStatus)
              : "";

          if (!idCheck.ok) {
            return {
              rowNumber: idx + 1,
              certId,
              type,
              name,
              details,
              issuedOn,
              status,
              validity: "invalid",
              reason: idCheck.error,
            };
          }
          if (seenInCsv.has(certId)) {
            return {
              rowNumber: idx + 1,
              certId,
              type,
              name,
              details,
              issuedOn,
              status,
              validity: "duplicate",
              reason: "Duplicate certId in CSV",
            };
          }
          seenInCsv.add(certId);

          const fieldCheck = validateCertificateFields({
            type,
            name,
            details,
            issuedOn,
            status: statusRaw,
          });
          if (!fieldCheck.ok) {
            return {
              rowNumber: idx + 1,
              certId,
              type,
              name,
              details,
              issuedOn,
              status,
              validity: "invalid",
              reason: fieldCheck.errors.join("; "),
            };
          }

          return {
            rowNumber: idx + 1,
            certId,
            ...fieldCheck.data,
            validity: "valid",
          };
        });

        setCsvRows(parsed);
      },
      error: (err) => {
        setImportError(err.message || "Failed to parse CSV file.");
      },
    });
  };

  const validCsvRows = useMemo(
    () => csvRows.filter((r) => r.validity === "valid"),
    [csvRows]
  );

  const handleBatchImport = async () => {
    if (validCsvRows.length === 0) return;
    setImporting(true);
    setImportError(null);
    setImportSummary(null);
    try {
      const now = Date.now();
      const outcomes = new Map<
        number,
        { validity: "imported" | "duplicate" | "error"; reason?: string }
      >();
      let createdCount = 0;
      let skippedDuplicateCount = 0;
      let failedCount = 0;

      const chunkSize = 5;
      for (let i = 0; i < validCsvRows.length; i += chunkSize) {
        const chunk = validCsvRows.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (row) => {
            try {
              const result = await createCertificateIfAbsent(row.certId, {
                type: row.type,
                name: row.name,
                details: row.details,
                issuedOn: row.issuedOn,
                status: row.status || "valid",
                createdAt: now,
                updatedAt: now,
              });
              if (result.outcome === "created") {
                createdCount += 1;
                outcomes.set(row.rowNumber, { validity: "imported" });
              } else {
                skippedDuplicateCount += 1;
                outcomes.set(row.rowNumber, {
                  validity: "duplicate",
                  reason: "Already exists in Firestore (skipped)",
                });
              }
            } catch (err) {
              failedCount += 1;
              outcomes.set(row.rowNumber, {
                validity: "error",
                reason: getErrorMessage(err, "Failed to create certificate."),
              });
            }
          })
        );
      }

      setCsvRows((prev) =>
        prev.map((row) => {
          const outcome = outcomes.get(row.rowNumber);
          return outcome ? { ...row, ...outcome } : row;
        })
      );

      if (createdCount > 0) {
        await fetchCertificates();
      }

      if (skippedDuplicateCount === 0 && failedCount === 0) {
        setImportOpen(false);
        setCsvRows([]);
      } else {
        setImportSummary(
          `Created ${createdCount} certificate${createdCount === 1 ? "" : "s"}. Skipped ${skippedDuplicateCount} duplicate${skippedDuplicateCount === 1 ? "" : "s"}${failedCount > 0 ? `. Failed ${failedCount}` : ""}.`
        );
      }
    } catch (err) {
      setImportError(getErrorMessage(err, "Batch import failed."));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#08090B]">
            Certificates
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Issue and verify certificates stored by uppercase document ID.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setCsvRows([]);
              setImportError(null);
              setImportSummary(null);
              setImportOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white text-[#08090B] font-semibold text-sm px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            Import CSV
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#D7FF3D] text-[#08090B] font-semibold text-sm px-5 py-2.5 shadow-sm hover:brightness-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add Certificate
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <strong className="font-semibold">Database Error: </strong>
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-500">
          Showing {filtered.length} of {certs.length} certificate
          {certs.length === 1 ? "" : "s"}
        </span>
        <div className="relative w-full sm:w-80">
          <Search
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            enterKeyHint="search"
            aria-label="Search certificates"
            placeholder="Search ID, name, type, details…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">
          Loading certificates…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 text-sm text-slate-500">
          <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
          No certificates found.
        </div>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label="Certificates table"
          className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"
        >
          <table className="w-full text-left border-collapse min-w-[740px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Certificate ID</th>
                <th className="py-3.5 px-4">Recipient & Type</th>
                <th className="py-3.5 px-4">Details</th>
                <th className="py-3.5 px-4">Issued On</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((cert) => (
                <tr key={cert.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-xs font-bold text-[#08090B] whitespace-nowrap">
                    {cert.id}
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-[#08090B]">{cert.name}</p>
                    <p className="text-xs text-slate-500">{cert.type}</p>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-[260px]">
                    <p className="line-clamp-2">{cert.details}</p>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-mono text-slate-600 whitespace-nowrap">
                    {cert.issuedOn}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(cert)}
                      title="Click to toggle valid / revoked"
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize border cursor-pointer transition-colors ${
                        cert.status === "valid"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                      }`}
                    >
                      {cert.status}
                    </button>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEdit(cert)}
                      aria-label={`Edit ${cert.id}`}
                      className="inline-flex items-center p-2 rounded-xl bg-slate-100 text-[#08090B] hover:bg-[#D7FF3D] mr-1.5 cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(cert)}
                      aria-label={`Delete ${cert.id}`}
                      className="inline-flex items-center p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? `Edit Certificate (${editingId})` : "Add Certificate"}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
            >
              {formError}
            </div>
          )}

          <div>
            <label
              htmlFor="cert-id"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Certificate ID *
            </label>
            <input
              id="cert-id"
              type="text"
              required
              maxLength={64}
              disabled={editingId !== null}
              value={form.certId}
              onChange={(e) =>
                setForm({ ...form, certId: e.target.value.toUpperCase() })
              }
              placeholder="EEE-HSTU-2026-0417"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-mono uppercase text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D] disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="cert-type"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Type *
            </label>
            <input
              id="cert-type"
              type="text"
              required
              maxLength={120}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              placeholder="Certificate of Achievement"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <div>
            <label
              htmlFor="cert-name"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Recipient Name *
            </label>
            <input
              id="cert-name"
              type="text"
              required
              maxLength={160}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nusrat Jahan Mim"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <div>
            <label
              htmlFor="cert-details"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Details *
            </label>
            <textarea
              id="cert-details"
              required
              rows={2}
              maxLength={300}
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              placeholder="Champion — Volt Rush 2026, Line follower"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="cert-issued"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Issued On *
              </label>
              <input
                id="cert-issued"
                type="date"
                required
                value={form.issuedOn}
                onChange={(e) => setForm({ ...form, issuedOn: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>
            <div>
              <label
                htmlFor="cert-status"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Status *
              </label>
              <select
                id="cert-status"
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as CertificateStatus,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm capitalize text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              >
                {CERTIFICATE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#D7FF3D] text-[#08090B] text-sm font-semibold hover:brightness-95 cursor-pointer disabled:opacity-50"
            >
              {saving
                ? "Saving…"
                : editingId
                  ? "Save Changes"
                  : "Issue Certificate"}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Import CSV Modal */}
      <ModalDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Certificates from CSV"
        maxWidthClass="max-w-3xl"
      >
        <div className="space-y-5 text-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <div className="space-y-0.5">
              <p className="font-semibold text-[#08090B]">
                Required CSV columns
              </p>
              <p className="text-xs font-mono text-slate-600">
                certId,type,name,details,issuedOn,status
              </p>
            </div>
            <a
              href="/certificates_template.csv"
              download
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-[#08090B] hover:bg-slate-100"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Download template
            </a>
          </div>

          <div>
            <label
              htmlFor="csv-upload-input"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Select CSV file
            </label>
            <input
              id="csv-upload-input"
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvFileChange}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#D7FF3D] file:text-[#08090B] hover:file:brightness-95 cursor-pointer"
            />
          </div>

          {importError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
            >
              {importError}
            </div>
          )}

          {importSummary && (
            <div
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800"
            >
              {importSummary}
            </div>
          )}

          {csvRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 text-xs font-semibold">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700">
                  Ready: {validCsvRows.length}
                </span>
                {csvRows.some((r) => r.validity === "imported") && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800">
                    Imported:{" "}
                    {csvRows.filter((r) => r.validity === "imported").length}
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700">
                  Duplicate:{" "}
                  {csvRows.filter((r) => r.validity === "duplicate").length}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700">
                  Invalid / Error:{" "}
                  {
                    csvRows.filter(
                      (r) => r.validity === "invalid" || r.validity === "error"
                    ).length
                  }
                </span>
              </div>

              <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Cert ID</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Issued</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvRows.map((row) => (
                      <tr key={`${row.rowNumber}-${row.certId}`}>
                        <td className="py-2 px-3 text-slate-400">
                          {row.rowNumber}
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold">
                          {row.certId || "—"}
                        </td>
                        <td className="py-2 px-3">{row.name || "—"}</td>
                        <td className="py-2 px-3 font-mono">
                          {row.issuedOn || "—"}
                        </td>
                        <td className="py-2 px-3">{row.status || "—"}</td>
                        <td className="py-2 px-3">
                          {row.validity === "valid" ? (
                            <span className="text-emerald-700 font-semibold">
                              Valid
                            </span>
                          ) : row.validity === "imported" ? (
                            <span className="text-emerald-700 font-semibold">
                              Imported
                            </span>
                          ) : row.validity === "duplicate" ? (
                            <span className="text-amber-700 font-medium">
                              Duplicate{row.reason ? `: ${row.reason}` : ""}
                            </span>
                          ) : (
                            <span className="text-red-600 font-medium">
                              {row.validity === "error" ? "Error" : "Invalid"}
                              {row.reason ? `: ${row.reason}` : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {importSummary ? "Close" : "Cancel"}
            </button>
            <button
              type="button"
              disabled={importing || validCsvRows.length === 0}
              onClick={handleBatchImport}
              className="px-5 py-2.5 rounded-xl bg-[#D7FF3D] text-[#08090B] text-sm font-semibold hover:brightness-95 cursor-pointer disabled:opacity-40"
            >
              {importing
                ? "Importing…"
                : `Import ${validCsvRows.length} Certificate${
                    validCsvRows.length === 1 ? "" : "s"
                  }`}
            </button>
          </div>
        </div>
      </ModalDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete certificate"
        message={
          deleteTarget
            ? `Permanently delete certificate "${deleteTarget.id}" (${deleteTarget.name})?`
            : ""
        }
      />
    </div>
  );
}
