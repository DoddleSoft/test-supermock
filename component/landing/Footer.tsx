"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Facebook,
  Instagram,
  Linkedin,
  Globe,
  Clock,
  Phone,
  MapPin,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { Center } from "@/context/CenterContext";

// WhatsApp icon (lucide-react doesn't include one)
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const SELECT_FIELDS =
  "name,slug,logo_url,about,website_url,facebook_url,instagram_url,linkedin_url,phone,address,whatsapp,operating_hours,latitude,longitude";

export default function Footer() {
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const [center, setCenter] = useState<Center | null>(null);

  useEffect(() => {
    if (!slug) return;
    const supabase = createClient();
    supabase
      .from("centers")
      .select(SELECT_FIELDS)
      .eq("slug", slug)
      .eq("is_active", true)
      .single()
      .then(({ data }) => {
        if (data) setCenter(data as Center);
      });
  }, [slug]);

  const hasContact = center?.phone || center?.address;

  const hasLocation =
    typeof center?.latitude === "number" &&
    typeof center?.longitude === "number";

  const hasOperatingHours =
    center?.operating_hours &&
    typeof center.operating_hours === "object" &&
    Object.keys(center.operating_hours).length > 0;

  return (
    <footer className="w-full bg-gray-50 border-t border-gray-200 pt-10 pb-6">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {center ? (
          <>
            {/* Main grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
              {/* Brand */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {center.logo_url && (
                    <Image
                      src={center.logo_url}
                      alt={`${center.name} logo`}
                      width={120}
                      height={40}
                      className="rounded-md object-contain"
                    />
                  )}
                </div>
                <span className="text-2xl font-semibold text-gray-900">
                  {center.name}
                </span>
                {center.about && (
                  <p className="text-md text-gray-500 leading-relaxed max-w-sm">
                    {center.about}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  {center.website_url && (
                    <Link
                      href={center.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Website"
                      className="text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <Globe className="h-5 w-5" />
                    </Link>
                  )}
                  {center.facebook_url && (
                    <Link
                      href={center.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Facebook"
                      className="text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <Facebook className="h-5 w-5" />
                    </Link>
                  )}

                  {center.whatsapp && (
                    <Link
                      href={`https://wa.me/${center.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="WhatsApp"
                      className="text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <WhatsAppIcon className="h-5 w-5" />
                    </Link>
                  )}
                  {center.instagram_url && (
                    <Link
                      href={center.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram"
                      className="text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <Instagram className="h-5 w-5" />
                    </Link>
                  )}
                  {center.linkedin_url && (
                    <Link
                      href={center.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="LinkedIn"
                      className="text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <Linkedin className="h-5 w-5" />
                    </Link>
                  )}
                </div>
              </div>

              {/* Contact */}
              {hasContact && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-900">Contact</h4>
                  <ul className="space-y-2 text-sm text-gray-500">
                    {center.phone && (
                      <li className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <a
                          href={`tel:${center.phone}`}
                          className="hover:text-gray-900 transition-colors"
                        >
                          {center.phone}
                        </a>
                      </li>
                    )}
                    {center.address && (
                      <li className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        <span>{center.address}</span>
                      </li>
                    )}

                    {/* Google Maps location view */}
                    {hasLocation &&
                      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
                        <li className="mt-2">
                          <div
                            className="rounded-md overflow-hidden border border-gray-200 w-full"
                            style={{ maxWidth: 320, height: 180 }}
                          >
                            <iframe
                              title="Center Location"
                              width="100%"
                              height="180"
                              style={{ border: 0 }}
                              loading="lazy"
                              allowFullScreen
                              referrerPolicy="no-referrer-when-downgrade"
                              src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${center.latitude},${center.longitude}&zoom=15`}
                            />
                          </div>
                        </li>
                      )}
                  </ul>
                </div>
              )}

              {/* Operating Hours Block Added Here */}
              {hasOperatingHours && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-900">
                    Operating Hours
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-500">
                    {Object.entries(center.operating_hours || {}).map(
                      ([day, hoursData]) => {
                        // Tell TypeScript what shape this data is
                        const hours = hoursData as any; // Using 'any' briefly here if your context type isn't globally available, or import the DailyHours type.

                        // Format the display string based on whether they are closed or open
                        const displayTime = hours?.closed
                          ? "Closed"
                          : `${hours?.open || "TBD"} - ${hours?.close || "TBD"}`;

                        return (
                          <li
                            key={day}
                            className="flex items-start justify-between gap-4"
                          >
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <span className="capitalize">{day}</span>
                            </div>
                            <span className="text-gray-900 font-medium text-right">
                              {displayTime}
                            </span>
                          </li>
                        );
                      },
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Bottom bar */}
            <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
              <p>
                &copy; {new Date().getFullYear()} SuperMock. All rights
                reserved.
              </p>
              <p>
                Powered by{" "}
                <span className="font-medium text-gray-500">
                  Doddle<span className="text-red-500">Soft</span>
                </span>
              </p>
            </div>
          </>
        ) : (
          /* Fallback — no center data (e.g. non-slug pages) */
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2">
              <Image
                src="/supermock-logo.png"
                alt="SuperMock Logo"
                width={32}
                height={32}
              />
              <span className="text-lg font-semibold text-gray-900">
                Super<span className="text-red-500">Mock</span>
              </span>
            </div>
            <p className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} SuperMock. All rights reserved.
            </p>
          </div>
        )}
      </div>
    </footer>
  );
}
