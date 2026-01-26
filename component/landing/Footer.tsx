import Link from "next/link";
import { Facebook, Instagram, Mail, Phone } from "lucide-react";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-black/5 text-gray-600 bg-gray-50 pt-12 pb-8 md:pt-16 md:pb-12">
      <div className="px-4 md:px-8 mx-auto max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 mb-8 md:mb-12">
          {/* Brand Column */}
          <div className="space-y-2 flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="flex items-center gap-2">
              <Image
                src="/supermock-logo.png"
                alt="SuperMock Logo"
                width={40}
                height={40}
              />
              <Link href="/" className="inline-block">
                <span className="text-2xl font-bold tracking-tight text-supermock-text">
                  Super<span className="text-supermock-red">Mock</span>
                </span>
              </Link>
            </div>

            <p className="text-sm md:text-base mb-4 text-supermock-text-secondary leading-relaxed max-w-md">
              Mock test platform for IELTS training centres.
            </p>

            <div className="flex items-center gap-4 text-supermock-text-secondary/60">
              <Link
                href="https://www.facebook.com/supermock.net"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-supermock-red transition-colors"
              >
                <Facebook className="w-5 h-5" />
              </Link>
              <Link
                href="https://www.instagram.com/supermock.ielts/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-supermock-red transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </Link>
              <Link
                href="https://www.tiktok.com/@supermock.ielts"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-supermock-red transition-colors"
                aria-label="TikTok"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="w-5 h-5"
                  fill="currentColor"
                >
                  <path d="M17.5 3c.5 1.8 1.9 3.2 3.7 3.7v3.1c-1.5.1-3-.3-4.2-1v7.2a6.2 6.2 0 1 1-6.2-6.2c.4 0 .8 0 1.2.1v3.3a2.9 2.9 0 1 0 2.9 2.9V3h2.6Z" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Product */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <h3 className="font-semibold text-supermock-text mb-4 md:mb-6">
              Product
            </h3>
            <ul className="space-y-3 md:space-y-4 text-supermock-text-secondary text-sm md:text-base">
              <li>
                <Link
                  href="/#pricing"
                  className="hover:text-supermock-text transition-colors"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/#features"
                  className="hover:text-supermock-text transition-colors"
                >
                  Features
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <h3 className="font-semibold text-supermock-text mb-4 md:mb-6">
              Contact
            </h3>
            <ul className="space-y-3 md:space-y-4 text-supermock-text-secondary text-sm md:text-base">
              <li className="flex items-center gap-3 justify-center sm:justify-start">
                <Mail className="w-5 h-5 text-supermock-red flex-shrink-0" />
                <span>contact@supermock.net</span>
              </li>
              <li className="flex items-center gap-3 justify-center sm:justify-start">
                <Phone className="w-5 h-5 text-supermock-red flex-shrink-0" />
                <span>+880 1635 931 004</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 md:pt-8 border-t border-black/5 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <p className="text-xs md:text-sm text-supermock-text-secondary/60">
            &copy; {new Date().getFullYear()} Supermock all rights reserved.
          </p>
          <p className="text-xs md:text-sm text-supermock-text-secondary/60">
            Designed by Doddlesoft
          </p>
        </div>
      </div>
    </footer>
  );
}
