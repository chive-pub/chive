import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  // `whitespace-nowrap` matches the upstream primitive and is what keeps a
  // two-word label from breaking inside its own pill: the vertical padding is
  // sized for one line, so a wrapped chip renders with its text pressed
  // against the border. Chips carrying a label long enough to outrun a phone
  // pair this with `truncate` at the call site.
  'inline-flex max-w-full items-center whitespace-nowrap rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
