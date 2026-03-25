'use client';

import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useIsAuthenticated } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/api/client';
import { getServiceAuthToken } from '@/lib/auth/service-auth';
import { getCurrentAgent } from '@/lib/auth/oauth-client';

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Inappropriate' },
  { value: 'copyright', label: 'Copyright Violation' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'other', label: 'Other' },
] as const;

type ReportReason = (typeof REPORT_REASONS)[number]['value'];

/**
 * Props for the ReportContentDialog component.
 */
export interface ReportContentDialogProps {
  /** AT-URI of the content to report. */
  targetUri: string;
  /** Collection NSID of the content (e.g., pub.chive.eprint.submission). */
  targetCollection: string;
  /** Custom trigger element. Defaults to a ghost button with a Flag icon. */
  trigger?: React.ReactNode;
}

/**
 * Dialog for reporting problematic content.
 *
 * @remarks
 * Allows authenticated users to report eprints, reviews, or other content
 * by selecting a reason and optionally providing additional details.
 * Submits to the pub.chive.moderation.createReport XRPC endpoint.
 */
export function ReportContentDialog({
  targetUri,
  targetCollection,
  trigger,
}: ReportContentDialogProps) {
  const isAuthenticated = useIsAuthenticated();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setReason('');
    setDescription('');
  };

  const handleSubmit = async () => {
    if (!reason) return;

    setIsSubmitting(true);
    try {
      const agent = getCurrentAgent();
      const token = agent
        ? await getServiceAuthToken(agent, 'pub.chive.moderation.createReport')
        : undefined;

      const response = await fetch(`${getApiBaseUrl()}/xrpc/pub.chive.moderation.createReport`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          targetUri,
          targetCollection,
          reason,
          description: description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.message ?? `Request failed with status ${response.status}`);
      }

      toast.success('Report submitted. Thank you for helping improve Chive.');
      resetForm();
      setOpen(false);
    } catch (error) {
      toast.error('Failed to submit report', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultTrigger = (
    <Button variant="ghost" size="sm">
      <Flag className="mr-1.5 h-4 w-4" />
      Report
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report Content</DialogTitle>
          <DialogDescription>
            Help us maintain quality by reporting problematic content.
          </DialogDescription>
        </DialogHeader>

        {!isAuthenticated ? (
          <p className="py-4 text-sm text-muted-foreground">Please sign in to report content.</p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <Label>Reason</Label>
              <RadioGroup value={reason} onValueChange={(val) => setReason(val as ReportReason)}>
                {REPORT_REASONS.map((r) => (
                  <div key={r.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={r.value} id={`report-reason-${r.value}`} />
                    <Label htmlFor={`report-reason-${r.value}`} className="font-normal">
                      {r.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-description">Additional details (optional)</Label>
              <Textarea
                id="report-description"
                placeholder="Provide additional details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {isAuthenticated && (
            <Button onClick={handleSubmit} disabled={!reason || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
