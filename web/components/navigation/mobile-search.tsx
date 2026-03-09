'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

/**
 * Mobile search trigger that opens a top Sheet with a search input.
 * Visible only below the sm breakpoint where the desktop SearchBar is hidden.
 */
export function MobileSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="sm:hidden">
          <Search className="h-5 w-5" />
          <span className="sr-only">Search</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="top" className="h-auto pb-6">
        <SheetTitle className="sr-only">Search</SheetTitle>
        <form onSubmit={handleSubmit} className="flex gap-2 pt-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search eprints, authors..."
            className="flex-1"
            autoFocus
          />
          <Button type="submit" size="sm">
            Search
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
