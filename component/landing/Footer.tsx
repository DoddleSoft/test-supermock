import Link from "next/link";
import { Facebook, Instagram, Mail, Phone } from "lucide-react";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="w-full text-gray-700 bg-gray-100 pt-12 pb-8 md:pt-16 md:pb-12">
      <div className="px-4 md:px-8 mx-auto max-w-7xl ">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-8 md:gap-12 mb-8 md:mb-12">
          {/* Brand Column */}
          <div className="space-y-2 flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
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

            <div className="sm:justify-start text-supermock-text-secondary/60 mt-2">
              <Link
                href="https://www.facebook.com/Supermock.fb"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-supermock-red transition-colors"
              >
                <Facebook className="w-6 h-6" />
              </Link>
            </div>
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
                <span>+880 1847 089 622</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-4 md:pt-6 border-t border-black/5 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <p className="text-xs text-gray-500">
            &copy;{new Date().getFullYear()} Supermock all rights reserved.
          </p>
          <p className="text-md md:text-sm text-gray-700">
            Designed by Doddlesoft
          </p>
        </div>
      </div>
    </footer>
  );
}
