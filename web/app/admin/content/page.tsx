'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  ThumbsUp,
  Search,
  MoreHorizontal,
  Trash2,
  Eye,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useAdminEprints,
  useAdminReviews,
  useAdminEndorsements,
  useDeleteContent,
} from '@/lib/hooks/use-admin';

/** Pending delete action awaiting confirmation. */
interface DeleteAction {
  uri: string;
  collection: string;
  label: string;
}

/**
 * Truncates a string to the specified length with an ellipsis.
 *
 * @param str - the string to truncate
 * @param maxLength - maximum character length before truncation
 * @returns the truncated string with trailing ellipsis, or the original if short enough
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}...`;
}

/**
 * Returns a color class for a content status badge.
 *
 * @param status - the eprint status string
 * @returns Tailwind CSS classes for the badge
 */
function statusBadgeClass(status: string): string {
  switch (status) {
    case 'published':
      return 'bg-green-500/15 text-green-700 border-green-200';
    case 'draft':
      return 'bg-yellow-500/15 text-yellow-700 border-yellow-200';
    case 'withdrawn':
      return 'bg-red-500/15 text-red-700 border-red-200';
    case 'flagged':
      return 'bg-orange-500/15 text-orange-700 border-orange-200';
    default:
      return 'bg-gray-500/15 text-gray-700 border-gray-200';
  }
}

/**
 * Content management page with tabbed views for eprints, reviews, and endorsements.
 *
 * Each tab provides a searchable table of indexed content with delete actions.
 * Search is debounced to avoid excessive API calls while typing.
 */
export default function AdminContentPage() {
  const [activeTab, setActiveTab] = useState('eprints');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [deleteAction, setDeleteAction] = useState<DeleteAction | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const deleteContent = useDeleteContent();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const eprintFilters = debouncedQuery ? { q: debouncedQuery } : {};
  const reviewFilters = debouncedQuery ? { q: debouncedQuery } : {};
  const endorsementFilters = debouncedQuery ? { q: debouncedQuery } : {};

  const { data: eprintsData, isLoading: eprintsLoading } = useAdminEprints(eprintFilters);
  const { data: reviewsData, isLoading: reviewsLoading } = useAdminReviews(reviewFilters);
  const { data: endorsementsData, isLoading: endorsementsLoading } =
    useAdminEndorsements(endorsementFilters);

  const eprints = eprintsData?.eprints ?? [];
  const reviews = reviewsData?.items ?? [];
  const endorsements = endorsementsData?.items ?? [];

  const handleDeleteConfirm = async () => {
    if (!deleteAction) return;

    try {
      await deleteContent.mutateAsync({
        uri: deleteAction.uri,
        collection: deleteAction.collection,
        reason: deleteReason || 'Removed by admin',
      });
    } finally {
      setDeleteAction(null);
      setDeleteReason('');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content Management</h1>
          <p className="text-muted-foreground">Browse and manage indexed content</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="eprints" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            Eprints
          </TabsTrigger>
          <TabsTrigger value="reviews" className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            Reviews
          </TabsTrigger>
          <TabsTrigger value="endorsements" className="flex items-center gap-1.5">
            <ThumbsUp className="h-4 w-4" />
            Endorsements
          </TabsTrigger>
        </TabsList>

        {/* Eprints Tab */}
        <TabsContent value="eprints" className="mt-4 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search eprints by title, author, or field..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Eprints
                {eprintsData?.cursor !== undefined && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({eprints.length} shown)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {eprintsLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : eprints.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {debouncedQuery
                      ? `No eprints found matching "${debouncedQuery}"`
                      : 'No eprints found'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Indexed At</TableHead>
                      <TableHead className="w-[70px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eprints.map(
                      (eprint: {
                        uri: string;
                        title?: string;
                        authorHandle?: string;
                        authorDid?: string;
                        status?: string;
                        fieldUris?: string[];
                        indexedAt?: string;
                        createdAt?: string;
                      }) => (
                        <TableRow key={eprint.uri}>
                          <TableCell className="font-medium min-w-0 max-w-[300px]">
                            <Link
                              href={`/eprints/${encodeURIComponent(eprint.uri)}`}
                              className="text-primary hover:underline truncate block"
                            >
                              {truncate(eprint.title ?? 'Untitled', 60)}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {eprint.authorHandle ?? eprint.authorDid ?? 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusBadgeClass(eprint.status ?? 'published')}>
                              {eprint.status ?? 'published'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {eprint.fieldUris && eprint.fieldUris.length > 0
                              ? `${eprint.fieldUris.length} field${eprint.fieldUris.length !== 1 ? 's' : ''}`
                              : 'None'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {(eprint.indexedAt ?? eprint.createdAt)
                              ? new Date(
                                  (eprint.indexedAt ?? eprint.createdAt)!
                                ).toLocaleDateString()
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/eprints/${encodeURIComponent(eprint.uri)}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() =>
                                    setDeleteAction({
                                      uri: eprint.uri,
                                      collection: 'pub.chive.eprint.submission',
                                      label: eprint.title ?? 'Untitled eprint',
                                    })
                                  }
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="mt-4 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reviews by author or eprint..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                Reviews
                {reviewsData?.total !== undefined && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({reviews.length} of {reviewsData.total})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reviewsLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {debouncedQuery
                      ? `No reviews found matching "${debouncedQuery}"`
                      : 'No reviews found'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Eprint</TableHead>
                      <TableHead>Reviewer</TableHead>
                      <TableHead>Motivation</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead className="w-[70px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.map((review) => (
                      <TableRow key={review.uri}>
                        <TableCell className="min-w-0 max-w-[350px]">
                          {review.eprintUri ? (
                            <Link
                              href={`/eprints/${encodeURIComponent(review.eprintUri)}`}
                              className="text-primary hover:underline truncate block"
                            >
                              {truncate(review.eprintTitle ?? 'Untitled', 60)}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {truncate(review.reviewerDid, 20)}
                        </TableCell>
                        <TableCell>
                          {review.motivation ? (
                            <Badge variant="outline">{review.motivation}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {review.createdAt
                            ? new Date(review.createdAt).toLocaleDateString()
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {review.eprintUri && (
                                <>
                                  <DropdownMenuItem asChild>
                                    <Link href={`/eprints/${encodeURIComponent(review.eprintUri)}`}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Eprint
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  setDeleteAction({
                                    uri: review.uri,
                                    collection: 'pub.chive.review.comment',
                                    label: `Review by ${truncate(review.reviewerDid, 20)}`,
                                  })
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Endorsements Tab */}
        <TabsContent value="endorsements" className="mt-4 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search endorsements by author or eprint..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ThumbsUp className="h-5 w-5 text-muted-foreground" />
                Endorsements
                {endorsementsData?.total !== undefined && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({endorsements.length} of {endorsementsData.total})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {endorsementsLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : endorsements.length === 0 ? (
                <div className="p-8 text-center">
                  <ThumbsUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {debouncedQuery
                      ? `No endorsements found matching "${debouncedQuery}"`
                      : 'No endorsements found'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Eprint</TableHead>
                      <TableHead>Endorser</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead className="w-[70px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endorsements.map((endorsement) => (
                      <TableRow key={endorsement.uri}>
                        <TableCell className="min-w-0 max-w-[350px]">
                          {endorsement.eprintUri ? (
                            <Link
                              href={`/eprints/${encodeURIComponent(endorsement.eprintUri)}`}
                              className="text-primary hover:underline truncate block"
                            >
                              {truncate(endorsement.eprintTitle ?? 'Untitled', 60)}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {truncate(endorsement.endorserDid, 20)}
                        </TableCell>
                        <TableCell>
                          {endorsement.endorsementType ? (
                            <Badge variant="outline">{endorsement.endorsementType}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {endorsement.createdAt
                            ? new Date(endorsement.createdAt).toLocaleDateString()
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {endorsement.eprintUri && (
                                <>
                                  <DropdownMenuItem asChild>
                                    <Link
                                      href={`/eprints/${encodeURIComponent(endorsement.eprintUri)}`}
                                    >
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Eprint
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  setDeleteAction({
                                    uri: endorsement.uri,
                                    collection: 'pub.chive.review.endorsement',
                                    label: `Endorsement by ${truncate(endorsement.endorserDid, 20)}`,
                                  })
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteAction} onOpenChange={() => setDeleteAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Content</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold">{deleteAction?.label}</span>? This action soft-deletes
              the content from the index.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="delete-reason" className="text-sm font-medium">
              Reason (optional)
            </label>
            <Input
              id="delete-reason"
              placeholder="Reason for deletion..."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAction(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteContent.isPending}
            >
              {deleteContent.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
