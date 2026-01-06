'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { mainNavItems } from './nav-config';

interface MobileNavProps {
  className?: string;
}

/**
 * Mobile navigation drawer with accordion-style collapsible sections.
 *
 * @remarks
 * Mirrors desktop navigation structure with "Discover" and "Community"
 * as expandable groups. Each group can be expanded independently.
 *
 * @example
 * ```tsx
 * <MobileNav className="md:hidden" />
 * ```
 */
export function MobileNav({ className }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['Discover']);
  const pathname = usePathname();

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className={className}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="left-0 top-0 h-full w-3/4 translate-x-0 translate-y-0 rounded-none data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm">
        <DialogTitle className="sr-only">Navigation Menu</DialogTitle>
        <ScrollArea className="my-4 h-[calc(100vh-8rem)] pb-10">
          <div className="flex flex-col space-y-2">
            <Link href="/" onClick={() => setOpen(false)} className="text-xl font-bold">
              Chive
            </Link>

            <nav className="mt-6 flex flex-col space-y-1">
              {mainNavItems.map((group) => {
                const isExpanded = expandedSections.includes(group.label);

                return (
                  <Collapsible
                    key={group.label}
                    open={isExpanded}
                    onOpenChange={() => toggleSection(group.label)}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="flex w-full items-center justify-between rounded-md p-3 text-lg font-medium hover:bg-accent">
                        {group.label}
                        <ChevronDown
                          className={cn(
                            'h-5 w-5 transition-transform duration-200',
                            isExpanded && 'rotate-180'
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                      <div className="flex flex-col space-y-1 px-3 py-2">
                        {group.children.map((item) => {
                          const Icon = item.icon;
                          const isActive = pathname?.startsWith(item.href);

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className={cn(
                                'flex items-center gap-3 rounded-md p-3 transition-colors hover:bg-accent',
                                isActive ? 'bg-accent/50 text-foreground' : 'text-muted-foreground'
                              )}
                            >
                              {Icon && <Icon className="h-5 w-5" />}
                              <div className="flex flex-col">
                                <span className="font-medium">{item.label}</span>
                                {item.description && (
                                  <span className="text-xs text-muted-foreground">
                                    {item.description}
                                  </span>
                                )}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </nav>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
