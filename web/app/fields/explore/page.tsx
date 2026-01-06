'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Network, ArrowLeft, Layers } from 'lucide-react';

import { FieldVisualization } from '@/components/knowledge-graph';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

/**
 * Knowledge graph field exploration page.
 *
 * @remarks
 * Full-screen interactive visualization of the field hierarchy.
 * Allows exploration of relationships between academic fields.
 */
export default function FieldExplorePage() {
  const searchParams = useSearchParams();
  const initialFieldId = searchParams.get('field') ?? 'computer-science';

  const [fieldId, setFieldId] = useState(initialFieldId);
  const [depth, setDepth] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/fields"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to fields
          </Link>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Network className="h-8 w-8" />
            Field Explorer
          </h1>
          <p className="text-muted-foreground">
            Interactive visualization of the knowledge graph field hierarchy
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Field search */}
            <div className="space-y-2">
              <Label>Jump to field</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (searchQuery) {
                      setFieldId(searchQuery.toLowerCase().replace(/\s+/g, '-'));
                    }
                  }}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Quick select */}
            <div className="space-y-2">
              <Label>Quick select</Label>
              <Select value={fieldId} onValueChange={setFieldId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="computer-science">Computer Science</SelectItem>
                  <SelectItem value="physics">Physics</SelectItem>
                  <SelectItem value="biology">Biology</SelectItem>
                  <SelectItem value="chemistry">Chemistry</SelectItem>
                  <SelectItem value="mathematics">Mathematics</SelectItem>
                  <SelectItem value="medicine">Medicine</SelectItem>
                  <SelectItem value="psychology">Psychology</SelectItem>
                  <SelectItem value="economics">Economics</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Depth control */}
            <div className="space-y-2">
              <Label>Relationship depth: {depth}</Label>
              <Slider
                value={[depth]}
                onValueChange={([v]: [number]) => setDepth(v)}
                min={1}
                max={3}
                step={1}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground">Higher depth shows more relationships</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visualization */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Knowledge Graph
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/fields/${fieldId}`}>View field details</Link>
            </Button>
          </div>
          <CardDescription>
            Click on nodes to navigate. Drag to pan, scroll to zoom.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <FieldVisualization fieldId={fieldId} depth={depth} height="600px" />
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary" />
              <span className="text-sm">Current field</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-200 dark:bg-blue-900" />
              <span className="text-sm">Field</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-200 dark:bg-green-900" />
              <span className="text-sm">Subfield</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-purple-200 dark:bg-purple-900" />
              <span className="text-sm">Topic</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 border-t-2 border-primary" />
              <span className="text-sm">Hierarchy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 border-t-2 border-dashed border-muted-foreground" />
              <span className="text-sm">Related</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
