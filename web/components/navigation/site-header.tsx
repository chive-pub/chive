import Image from 'next/image';
import Link from 'next/link';

import { MainNav } from './main-nav';
import { MobileNav } from './mobile-nav';
import { ThemeToggle } from './theme-toggle';
import { SearchBar } from './search-bar';
import { AuthButton } from './auth-button';

/**
 * Main site header with navigation.
 * Responsive design: desktop nav + mobile hamburger menu.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Logo */}
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <Image src="/chive-logo.svg" alt="Chive" width={28} height={28} />
          <span className="text-xl font-bold">Chive</span>
        </Link>

        {/* Desktop Navigation */}
        <MainNav className="hidden md:flex" />

        {/* Right side: Search, Auth, Theme Toggle, Mobile Nav */}
        <div className="flex flex-1 items-center justify-end space-x-4">
          <SearchBar className="hidden sm:flex" />
          <AuthButton />
          <ThemeToggle />
          <MobileNav className="md:hidden" />
        </div>
      </div>
    </header>
  );
}
