import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';

describe('Card', () => {
  it('renders Card component', () => {
    render(<Card>Content</Card>);

    const card = screen.getByText('Content');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('rounded-xl');
    expect(card).toHaveClass('border');
    expect(card).toHaveClass('bg-card');
  });

  it('applies custom className to Card', () => {
    render(<Card className="custom-card">Content</Card>);

    const card = screen.getByText('Content');
    expect(card).toHaveClass('custom-card');
  });

  it('forwards ref to Card', () => {
    const ref = { current: null };
    render(<Card ref={ref}>Content</Card>);

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('CardHeader', () => {
  it('renders CardHeader component', () => {
    render(<CardHeader>Header</CardHeader>);

    const header = screen.getByText('Header');
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass('flex');
    expect(header).toHaveClass('flex-col');
    expect(header).toHaveClass('p-6');
  });

  it('applies custom className to CardHeader', () => {
    render(<CardHeader className="custom-header">Header</CardHeader>);

    const header = screen.getByText('Header');
    expect(header).toHaveClass('custom-header');
  });
});

describe('CardTitle', () => {
  it('renders CardTitle component', () => {
    render(<CardTitle>Title</CardTitle>);

    const title = screen.getByText('Title');
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass('font-semibold');
    expect(title).toHaveClass('tracking-tight');
  });

  it('applies custom className to CardTitle', () => {
    render(<CardTitle className="custom-title">Title</CardTitle>);

    const title = screen.getByText('Title');
    expect(title).toHaveClass('custom-title');
  });
});

describe('CardDescription', () => {
  it('renders CardDescription component', () => {
    render(<CardDescription>Description</CardDescription>);

    const description = screen.getByText('Description');
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass('text-sm');
    expect(description).toHaveClass('text-muted-foreground');
  });

  it('applies custom className to CardDescription', () => {
    render(<CardDescription className="custom-desc">Description</CardDescription>);

    const description = screen.getByText('Description');
    expect(description).toHaveClass('custom-desc');
  });
});

describe('CardContent', () => {
  it('renders CardContent component', () => {
    render(<CardContent>Content</CardContent>);

    const content = screen.getByText('Content');
    expect(content).toBeInTheDocument();
    expect(content).toHaveClass('p-6');
    expect(content).toHaveClass('pt-0');
  });

  it('applies custom className to CardContent', () => {
    render(<CardContent className="custom-content">Content</CardContent>);

    const content = screen.getByText('Content');
    expect(content).toHaveClass('custom-content');
  });
});

describe('CardFooter', () => {
  it('renders CardFooter component', () => {
    render(<CardFooter>Footer</CardFooter>);

    const footer = screen.getByText('Footer');
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass('flex');
    expect(footer).toHaveClass('items-center');
    expect(footer).toHaveClass('p-6');
    expect(footer).toHaveClass('pt-0');
  });

  it('applies custom className to CardFooter', () => {
    render(<CardFooter className="custom-footer">Footer</CardFooter>);

    const footer = screen.getByText('Footer');
    expect(footer).toHaveClass('custom-footer');
  });
});

describe('Card Composition', () => {
  it('renders a complete card with all sub-components', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Title</CardTitle>
          <CardDescription>Test Description</CardDescription>
        </CardHeader>
        <CardContent>Test Content</CardContent>
        <CardFooter>Test Footer</CardFooter>
      </Card>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(screen.getByText('Test Footer')).toBeInTheDocument();
  });
});
