'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Building2, Loader2, X, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAlphaApply } from '@/lib/hooks/use-alpha-status';
import {
  useAffiliationAutocomplete,
  type AffiliationSuggestion,
} from '@/lib/hooks/use-profile-autocomplete';
import type { AlphaSector, AlphaCareerStage, AlphaAffiliation } from '@/lib/api/schema';

/**
 * Sector options for alpha applications.
 */
const SECTOR_OPTIONS: { value: AlphaSector; label: string }[] = [
  { value: 'academia', label: 'Academia' },
  { value: 'industry', label: 'Industry' },
  { value: 'government', label: 'Government' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'independent', label: 'Independent' },
  { value: 'other', label: 'Other' },
];

/**
 * Career stage options for alpha applications.
 */
const CAREER_STAGE_OPTIONS: { value: AlphaCareerStage; label: string }[] = [
  { value: 'undergraduate', label: 'Undergraduate Student' },
  { value: 'graduate-masters', label: "Master's Student" },
  { value: 'graduate-phd', label: 'PhD Student' },
  { value: 'postdoc', label: 'Postdoctoral Researcher' },
  { value: 'research-staff', label: 'Research Staff' },
  { value: 'junior-faculty', label: 'Junior Faculty' },
  { value: 'senior-faculty', label: 'Senior Faculty' },
  { value: 'research-admin', label: 'Research Administrator' },
  { value: 'librarian', label: 'Librarian' },
  { value: 'science-communicator', label: 'Science Communicator' },
  { value: 'policy-professional', label: 'Policy Professional' },
  { value: 'retired', label: 'Retired' },
  { value: 'other', label: 'Other' },
];

/**
 * Affiliation schema for form validation.
 */
const affiliationSchema = z
  .object({
    name: z.string().min(1).max(200),
    rorId: z.string().url().optional(),
  })
  .optional();

/**
 * Form validation schema for alpha signup.
 */
const formSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    sector: z.enum(
      ['academia', 'industry', 'government', 'nonprofit', 'healthcare', 'independent', 'other'],
      { message: 'Please select your sector' }
    ),
    sectorOther: z.string().max(100).optional(),
    careerStage: z.enum(
      [
        'undergraduate',
        'graduate-masters',
        'graduate-phd',
        'postdoc',
        'research-staff',
        'junior-faculty',
        'senior-faculty',
        'research-admin',
        'librarian',
        'science-communicator',
        'policy-professional',
        'retired',
        'other',
      ],
      { message: 'Please select your career stage' }
    ),
    careerStageOther: z.string().max(100).optional(),
    affiliation: affiliationSchema,
    researchField: z
      .string()
      .min(1, 'Please enter your research field')
      .max(200, 'Research field must be 200 characters or less'),
    motivation: z.string().max(1000, 'Motivation must be 1000 characters or less').optional(),
  })
  .refine(
    (data) => data.sector !== 'other' || (data.sectorOther && data.sectorOther.trim().length > 0),
    {
      message: 'Please specify your sector',
      path: ['sectorOther'],
    }
  )
  .refine(
    (data) =>
      data.careerStage !== 'other' ||
      (data.careerStageOther && data.careerStageOther.trim().length > 0),
    {
      message: 'Please specify your career stage',
      path: ['careerStageOther'],
    }
  );

type FormValues = z.infer<typeof formSchema>;

export interface AlphaSignupFormProps {
  onSuccess?: () => void;
}

/**
 * Single affiliation autocomplete input.
 */
function AffiliationInput({
  value,
  onChange,
}: {
  value: AlphaAffiliation | undefined;
  onChange: (value: AlphaAffiliation | undefined) => void;
}) {
  const [inputValue, setInputValue] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { data, isLoading } = useAffiliationAutocomplete(inputValue, {
    enabled: inputValue.length >= 2,
  });

  const suggestions = React.useMemo(() => data?.suggestions ?? [], [data?.suggestions]);
  const shouldShowDropdown = open && inputValue.length >= 2;

  const handleSelect = React.useCallback(
    (suggestion: AffiliationSuggestion) => {
      onChange({ name: suggestion.name, rorId: suggestion.rorId });
      setInputValue('');
      setOpen(false);
    },
    [onChange]
  );

  const handleAddFreeText = React.useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onChange({ name: trimmed });
    setInputValue('');
    setOpen(false);
  }, [inputValue, onChange]);

  const handleClear = React.useCallback(() => {
    onChange(undefined);
    setInputValue('');
    inputRef.current?.focus();
  }, [onChange]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (suggestions.length > 0) {
          handleSelect(suggestions[0]);
        } else if (inputValue.trim()) {
          handleAddFreeText();
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    },
    [suggestions, handleSelect, inputValue, handleAddFreeText]
  );

  // If there's a selected value, show it as a badge
  if (value) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1 py-1.5 px-3 text-sm">
          <Building2 className="h-3 w-3" />
          {value.name}
          {value.rorId && (
            <a
              href={value.rorId}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
              title="View on ROR"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            type="button"
            onClick={handleClear}
            className="ml-1 hover:text-destructive"
            aria-label="Clear affiliation"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      </div>
    );
  }

  return (
    <Popover open={shouldShowDropdown} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (e.target.value.length >= 2) {
                setOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => inputValue.length >= 2 && setOpen(true)}
            placeholder="Search institutions..."
            className="pl-9"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {isLoading && suggestions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                <p className="mt-2">Searching ROR...</p>
              </div>
            ) : suggestions.length === 0 ? (
              <CommandEmpty>
                <div className="text-center">
                  <p>No institutions found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Press Enter to add &quot;{inputValue}&quot; as free text
                  </p>
                </div>
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {suggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion.rorId}
                    value={suggestion.rorId}
                    onSelect={() => handleSelect(suggestion)}
                    className="flex flex-col items-start gap-1 py-3"
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <span className="text-sm font-medium">{suggestion.name}</span>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        ROR
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{suggestion.country}</span>
                      {suggestion.acronym && (
                        <>
                          <span>•</span>
                          <span>{suggestion.acronym}</span>
                        </>
                      )}
                      {suggestion.types.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{suggestion.types.join(', ')}</span>
                        </>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Alpha tester signup form.
 *
 * @remarks
 * Collects user information for alpha tester applications including:
 * - Email for notifications
 * - Sector (organization type)
 * - Career stage/position
 * - Institutional affiliation (optional, with ROR lookup)
 * - Research field
 * - Optional motivation statement
 */
export function AlphaSignupForm({ onSuccess }: AlphaSignupFormProps) {
  const { mutate: apply, isPending, error } = useAlphaApply();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      sector: undefined,
      sectorOther: '',
      careerStage: undefined,
      careerStageOther: '',
      affiliation: undefined,
      researchField: '',
      motivation: '',
    },
  });

  const watchSector = form.watch('sector');
  const watchCareerStage = form.watch('careerStage');

  function onSubmit(values: FormValues) {
    apply(
      {
        email: values.email,
        sector: values.sector,
        sectorOther: values.sector === 'other' ? values.sectorOther : undefined,
        careerStage: values.careerStage,
        careerStageOther: values.careerStage === 'other' ? values.careerStageOther : undefined,
        affiliation: values.affiliation,
        researchField: values.researchField,
        motivation: values.motivation || undefined,
      },
      {
        onSuccess: () => {
          onSuccess?.();
        },
      }
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight">Join the Alpha</h2>
        <p className="mt-2 text-muted-foreground">
          Sign up to be notified when Chive launches and get early access.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="you@example.com" {...field} />
                </FormControl>
                <FormDescription>
                  We will notify you when your application is reviewed.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sector"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sector</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your sector" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SECTOR_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>The type of organization you work with.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {watchSector === 'other' && (
            <FormField
              control={form.control}
              name="sectorOther"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specify Sector</FormLabel>
                  <FormControl>
                    <Input placeholder="Your sector" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="careerStage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Career Stage</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your career stage" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CAREER_STAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Your current position or career stage.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {watchCareerStage === 'other' && (
            <FormField
              control={form.control}
              name="careerStageOther"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specify Career Stage</FormLabel>
                  <FormControl>
                    <Input placeholder="Your career stage" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="affiliation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Affiliation (optional)</FormLabel>
                <FormControl>
                  <AffiliationInput value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormDescription>Your institutional affiliation, if any.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="researchField"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Research Field</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Computational Biology, Medieval History" {...field} />
                </FormControl>
                <FormDescription>Your primary research field or discipline.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="motivation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Motivation (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell us why you're interested in Chive..."
                    className="min-h-[100px] resize-none"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Optional: Share what interests you about decentralized scholarly communication.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error.message}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Submitting...' : 'Submit Application'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
