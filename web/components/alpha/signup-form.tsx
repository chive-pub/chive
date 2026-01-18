'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
import { useAlphaApply } from '@/lib/hooks/use-alpha-status';
import { AffiliationAutocompleteInput } from '@/components/settings/affiliation-autocomplete-input';
import { KeywordAutocompleteInput } from '@/components/settings/keyword-autocomplete-input';
import type { AlphaSector, AlphaCareerStage, Affiliation, ResearchKeyword } from '@/lib/api/schema';

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
const affiliationSchema = z.object({
  name: z.string().min(1).max(200),
  rorId: z.string().max(100).optional(),
});

/**
 * Research keyword schema for form validation.
 */
const keywordSchema = z.object({
  label: z.string().min(1).max(100),
  fastId: z.string().max(20).optional(),
  wikidataId: z.string().max(20).optional(),
});

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
    affiliations: z.array(affiliationSchema).max(10).optional(),
    researchKeywords: z
      .array(keywordSchema)
      .min(1, 'Please add at least one research keyword')
      .max(10),
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
 * Alpha tester signup form.
 *
 * @remarks
 * Collects user information for alpha tester applications including:
 * - Email for notifications
 * - Sector (organization type)
 * - Career stage/position
 * - Institutional affiliations (optional, multiple with ROR lookup)
 * - Research keywords (with FAST/Wikidata autocomplete)
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
      affiliations: [],
      researchKeywords: [],
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
        affiliations: values.affiliations,
        researchKeywords: values.researchKeywords,
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
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
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
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
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
            name="affiliations"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <AffiliationAutocompleteInput
                    label="Affiliations (optional)"
                    values={(field.value as Affiliation[]) ?? []}
                    onChange={(values) => field.onChange(values)}
                    placeholder="Search institutions..."
                    maxItems={10}
                    description="Add your institutional affiliations (up to 10)"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="researchKeywords"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <KeywordAutocompleteInput
                    label="Research Keywords"
                    values={(field.value as ResearchKeyword[]) ?? []}
                    onChange={(values) => field.onChange(values)}
                    placeholder="Search keywords..."
                    maxItems={10}
                    description="Add keywords describing your research areas"
                  />
                </FormControl>
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
