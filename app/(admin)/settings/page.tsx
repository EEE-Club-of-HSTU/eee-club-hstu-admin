"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteField, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  formatTimestamp,
  getErrorMessage,
  validateHttpsUrl,
} from "@/lib/format";
import { MapPin, Save, Share2 } from "lucide-react";

interface FooterFormState {
  email: string;
  phone: string;
  officeHours: string;
  room: string;
  address: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
  githubUrl: string;
}

interface LocationFormState {
  name: string;
  address: string;
  mapUrl: string;
}

const emptyFooter: FooterFormState = {
  email: "",
  phone: "",
  officeHours: "",
  room: "",
  address: "",
  facebookUrl: "",
  instagramUrl: "",
  linkedinUrl: "",
  youtubeUrl: "",
  githubUrl: "",
};

const emptyLocation: LocationFormState = {
  name: "",
  address: "",
  mapUrl: "",
};

const SOCIAL_FIELDS: Array<{
  key: keyof Pick<
    FooterFormState,
    "facebookUrl" | "instagramUrl" | "linkedinUrl" | "youtubeUrl" | "githubUrl"
  >;
  label: string;
  placeholder: string;
}> = [
  {
    key: "facebookUrl",
    label: "Facebook URL",
    placeholder: "https://facebook.com/eeeclubhstu",
  },
  {
    key: "instagramUrl",
    label: "Instagram URL",
    placeholder: "https://instagram.com/eeeclubhstu",
  },
  {
    key: "linkedinUrl",
    label: "LinkedIn URL",
    placeholder: "https://linkedin.com/company/eeeclubhstu",
  },
  {
    key: "youtubeUrl",
    label: "YouTube URL",
    placeholder: "https://youtube.com/@eeeclubhstu",
  },
  {
    key: "githubUrl",
    label: "GitHub URL",
    placeholder: "https://github.com/eee-club-hstu",
  },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [footer, setFooter] = useState<FooterFormState>(emptyFooter);
  const [footerUpdatedAt, setFooterUpdatedAt] = useState<number | null>(null);
  const [footerSaving, setFooterSaving] = useState(false);
  const [footerError, setFooterError] = useState<string | null>(null);
  const [footerSaved, setFooterSaved] = useState<string | null>(null);

  const [location, setLocation] = useState<LocationFormState>(emptyLocation);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<number | null>(
    null
  );
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSaved, setLocationSaved] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [footerSnap, locationSnap] = await Promise.all([
        getDoc(doc(db, "site_settings", "footer")),
        getDoc(doc(db, "site_settings", "location")),
      ]);

      if (footerSnap.exists()) {
        const d = footerSnap.data();
        setFooter({
          email: String(d.email ?? ""),
          phone: String(d.phone ?? ""),
          officeHours: String(d.officeHours ?? ""),
          room: String(d.room ?? ""),
          address: String(d.address ?? ""),
          facebookUrl: String(d.facebookUrl ?? ""),
          instagramUrl: String(d.instagramUrl ?? ""),
          linkedinUrl: String(d.linkedinUrl ?? ""),
          youtubeUrl: String(d.youtubeUrl ?? ""),
          githubUrl: String(d.githubUrl ?? ""),
        });
        setFooterUpdatedAt(
          typeof d.updatedAt === "number" ? d.updatedAt : null
        );
      }

      if (locationSnap.exists()) {
        const d = locationSnap.data();
        setLocation({
          name: String(d.name ?? ""),
          address: String(d.address ?? ""),
          mapUrl: String(d.mapUrl ?? ""),
        });
        setLocationUpdatedAt(
          typeof d.updatedAt === "number" ? d.updatedAt : null
        );
      }
    } catch (err) {
      setLoadError(
        getErrorMessage(
          err,
          "Failed to load site settings. Check database permissions."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveFooter = async (e: React.FormEvent) => {
    e.preventDefault();
    setFooterError(null);
    setFooterSaved(null);

    const email = footer.email.trim();
    const phone = footer.phone.trim();
    const officeHours = footer.officeHours.trim();
    const room = footer.room.trim();
    const address = footer.address.trim();

    if (
      email &&
      (email.length > 300 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ) {
      setFooterError("Enter a valid email address (300 chars max).");
      return;
    }
    if (
      phone.length > 300 ||
      officeHours.length > 300 ||
      room.length > 300 ||
      address.length > 300
    ) {
      setFooterError("Contact fields must each be 300 characters or fewer.");
      return;
    }

    const validatedUrls: Partial<Record<keyof FooterFormState, string>> = {};
    for (const social of SOCIAL_FIELDS) {
      const check = validateHttpsUrl(footer[social.key], {
        label: social.label,
      });
      if (!check.ok) {
        setFooterError(check.error);
        return;
      }
      validatedUrls[social.key] = check.value;
    }

    const updatedAt = Date.now();
    setFooterSaving(true);
    try {
      await setDoc(
        doc(db, "site_settings", "footer"),
        {
          email: email || deleteField(),
          phone: phone || deleteField(),
          officeHours: officeHours || deleteField(),
          room: room || deleteField(),
          address: address || deleteField(),
          facebookUrl: validatedUrls.facebookUrl || deleteField(),
          instagramUrl: validatedUrls.instagramUrl || deleteField(),
          linkedinUrl: validatedUrls.linkedinUrl || deleteField(),
          youtubeUrl: validatedUrls.youtubeUrl || deleteField(),
          githubUrl: validatedUrls.githubUrl || deleteField(),
          updatedAt,
        },
        { merge: true }
      );
      setFooterUpdatedAt(updatedAt);
      setFooterSaved("Footer contact and social links saved.");
    } catch (err) {
      setFooterError(getErrorMessage(err, "Failed to save footer settings."));
    } finally {
      setFooterSaving(false);
    }
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocationError(null);
    setLocationSaved(null);

    const name = location.name.trim();
    const address = location.address.trim();

    if (name.length > 160) {
      setLocationError("Location name must be 160 characters or fewer.");
      return;
    }
    if (address.length > 300) {
      setLocationError("Address must be 300 characters or fewer.");
      return;
    }

    const mapCheck = validateHttpsUrl(location.mapUrl, { label: "Map URL" });
    if (!mapCheck.ok) {
      setLocationError(mapCheck.error);
      return;
    }

    const updatedAt = Date.now();
    setLocationSaving(true);
    try {
      await setDoc(
        doc(db, "site_settings", "location"),
        {
          name: name || deleteField(),
          address: address || deleteField(),
          mapUrl: mapCheck.value || deleteField(),
          updatedAt,
        },
        { merge: true }
      );
      setLocationUpdatedAt(updatedAt);
      setLocationSaved("Campus location settings saved.");
    } catch (err) {
      setLocationError(
        getErrorMessage(err, "Failed to save location settings.")
      );
    } finally {
      setLocationSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#08090B]">
          Site Settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure footer contact details, social links (https:// only), and campus map location.
        </p>
      </div>

      {loadError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <strong className="font-semibold">Database Error: </strong>
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">
          Loading site settings…
        </div>
      ) : loadError ? (
        // Never show editable forms after a failed load: saving empty fields would wipe the live footer.
        <div className="py-12 text-center">
          <p className="text-sm text-slate-600 mb-4">
            Settings could not be loaded, so editing is disabled to protect the current values.
          </p>
          <button
            type="button"
            onClick={() => fetchSettings()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D7FF3D] text-[#08090B] text-sm font-semibold hover:brightness-95 cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {/* Footer & Contact Form */}
          <form
            onSubmit={handleSaveFooter}
            className="rounded-[24px] border border-slate-200 bg-white p-6 space-y-5"
          >
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-[#08090B] flex items-center gap-2">
                  <Share2 className="w-4 h-4" aria-hidden="true" />
                  Footer &amp; Contact Details
                </h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  site_settings/footer
                </p>
              </div>
              {footerUpdatedAt && (
                <span className="text-[11px] text-slate-500">
                  Updated {formatTimestamp(footerUpdatedAt)}
                </span>
              )}
            </div>

            {footerError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
              >
                {footerError}
              </div>
            )}
            {footerSaved && (
              <div
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700"
              >
                {footerSaved}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="footer-email"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
                >
                  Email
                </label>
                <input
                  id="footer-email"
                  type="email"
                  maxLength={300}
                  value={footer.email}
                  onChange={(e) =>
                    setFooter({ ...footer, email: e.target.value })
                  }
                  placeholder="eeeclub@hstu.ac.bd"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
                />
              </div>

              <div>
                <label
                  htmlFor="footer-phone"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
                >
                  Phone
                </label>
                <input
                  id="footer-phone"
                  type="text"
                  maxLength={300}
                  value={footer.phone}
                  onChange={(e) =>
                    setFooter({ ...footer, phone: e.target.value })
                  }
                  placeholder="+880 1700-000000"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
                />
              </div>

              <div>
                <label
                  htmlFor="footer-hours"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
                >
                  Office Hours
                </label>
                <input
                  id="footer-hours"
                  type="text"
                  maxLength={300}
                  value={footer.officeHours}
                  onChange={(e) =>
                    setFooter({ ...footer, officeHours: e.target.value })
                  }
                  placeholder="Sun–Thu · 14:00–17:00"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
                />
              </div>

              <div>
                <label
                  htmlFor="footer-room"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
                >
                  Room
                </label>
                <input
                  id="footer-room"
                  type="text"
                  maxLength={300}
                  value={footer.room}
                  onChange={(e) =>
                    setFooter({ ...footer, room: e.target.value })
                  }
                  placeholder="EEE Building, Room 214"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="footer-address"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Address
              </label>
              <input
                id="footer-address"
                type="text"
                maxLength={300}
                value={footer.address}
                onChange={(e) =>
                  setFooter({ ...footer, address: e.target.value })
                }
                placeholder="Department of EEE, HSTU, Dinajpur 5200, Bangladesh"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div className="pt-2 space-y-3 border-t border-slate-100">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Social Links (https:// only — leave blank to hide icon)
              </p>
              {SOCIAL_FIELDS.map((social) => (
                <div key={social.key}>
                  <label
                    htmlFor={`footer-${social.key}`}
                    className="block text-xs font-semibold text-slate-600 mb-1"
                  >
                    {social.label}
                  </label>
                  <input
                    id={`footer-${social.key}`}
                    type="url"
                    maxLength={500}
                    value={footer[social.key]}
                    onChange={(e) =>
                      setFooter({ ...footer, [social.key]: e.target.value })
                    }
                    placeholder={social.placeholder}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={footerSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D7FF3D] text-[#08090B] text-sm font-semibold hover:brightness-95 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                {footerSaving ? "Saving…" : "Save Footer"}
              </button>
            </div>
          </form>

          {/* Location Form */}
          <form
            onSubmit={handleSaveLocation}
            className="rounded-[24px] border border-slate-200 bg-white p-6 space-y-5"
          >
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-[#08090B] flex items-center gap-2">
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                  Location &amp; Map
                </h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  site_settings/location
                </p>
              </div>
              {locationUpdatedAt && (
                <span className="text-[11px] text-slate-500">
                  Updated {formatTimestamp(locationUpdatedAt)}
                </span>
              )}
            </div>

            {locationError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
              >
                {locationError}
              </div>
            )}
            {locationSaved && (
              <div
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700"
              >
                {locationSaved}
              </div>
            )}

            <div>
              <label
                htmlFor="loc-name"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Place Name (max 160)
              </label>
              <input
                id="loc-name"
                type="text"
                maxLength={160}
                value={location.name}
                onChange={(e) =>
                  setLocation({ ...location, name: e.target.value })
                }
                placeholder="Department of EEE, HSTU"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div>
              <label
                htmlFor="loc-address"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Address (max 300)
              </label>
              <textarea
                id="loc-address"
                rows={3}
                maxLength={300}
                value={location.address}
                onChange={(e) =>
                  setLocation({ ...location, address: e.target.value })
                }
                placeholder="Basherhat, Dinajpur 5200, Bangladesh"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div>
              <label
                htmlFor="loc-map"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Google Maps URL (https:// only)
              </label>
              <input
                id="loc-map"
                type="url"
                maxLength={500}
                value={location.mapUrl}
                onChange={(e) =>
                  setLocation({ ...location, mapUrl: e.target.value })
                }
                placeholder="https://www.google.com/maps/search/Hajee+Mohammad+Danesh+Science+and+Technology+University"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={locationSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D7FF3D] text-[#08090B] text-sm font-semibold hover:brightness-95 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                {locationSaving ? "Saving…" : "Save Location"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
