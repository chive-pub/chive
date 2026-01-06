'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { mainNavItems } from './nav-config';

/**
 * Props for the MainNav component.
 */
interface MainNavProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Desktop main navigation with dropdown menus.
 *
 * @remarks
 * Industry-standard navigation pattern with two dropdown groups:
 * - "Discover" for content browsing features
 * - "Community" for participation features
 *
 * Uses Radix UI NavigationMenu for accessible keyboard navigation
 * and proper ARIA attributes.
 *
 * @example
 * ```tsx
 * <header>
 *   <MainNav className="hidden md:flex" />
 * </header>
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the main navigation
 */
export function MainNav({ className }: MainNavProps) {
  const pathname = usePathname();

  return (
    <NavigationMenu className={className}>
      <NavigationMenuList>
        {mainNavItems.map((group) => (
          <NavigationMenuItem key={group.label}>
            <NavigationMenuTrigger>{group.label}</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                {group.children.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname?.startsWith(item.href);

                  return (
                    <li key={item.href}>
                      <NavigationMenuLink asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
                            isActive && 'bg-accent/50'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-sm font-medium leading-none">{item.label}</span>
                          </div>
                          {item.description && (
                            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  );
                })}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
