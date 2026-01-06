import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GraphemeCounter, isOverLimit } from './grapheme-counter';
import { countGraphemes } from '@/lib/bluesky';

describe('countGraphemes', () => {
  it('counts ASCII characters correctly', () => {
    expect(countGraphemes('Hello')).toBe(5);
    expect(countGraphemes('Hello World')).toBe(11);
  });

  it('counts emojis as single graphemes', () => {
    // Simple emoji: wave emoji U+1F44B
    expect(countGraphemes('Hello \u{1F44B}')).toBe(7);

    // Emoji with skin tone modifier: waving hand + medium skin tone
    expect(countGraphemes('\u{1F44B}\u{1F3FD}')).toBe(1);

    // Family emoji (ZWJ sequence): man + woman + girl + girl
    expect(countGraphemes('\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F467}')).toBe(1);
  });

  it('counts accented characters correctly', () => {
    // 'e' with combining acute accent should be 1 grapheme
    expect(countGraphemes('cafe\u0301')).toBe(4); // cafe with combining acute = 4 graphemes
    expect(countGraphemes('caf\u00E9')).toBe(4); // precomposed café = 4 graphemes
  });

  it('counts CJK characters correctly', () => {
    // Japanese: "hello" in hiragana
    expect(countGraphemes('\u3053\u3093\u306B\u3061\u306F')).toBe(5);
    // Chinese: "hello" in simplified
    expect(countGraphemes('\u4F60\u597D')).toBe(2);
  });

  it('handles empty string', () => {
    expect(countGraphemes('')).toBe(0);
  });

  it('counts mixed content correctly', () => {
    // H i ! space flag-emoji waving-emoji
    expect(countGraphemes('Hi! \u{1F1FA}\u{1F1F8}\u{1F44B}')).toBe(6);
  });
});

describe('isOverLimit', () => {
  it('returns false when under limit', () => {
    expect(isOverLimit('Hello', 300)).toBe(false);
  });

  it('returns false when at limit', () => {
    expect(isOverLimit('a'.repeat(300), 300)).toBe(false);
  });

  it('returns true when over limit', () => {
    expect(isOverLimit('a'.repeat(301), 300)).toBe(true);
  });

  it('uses default limit of 300', () => {
    expect(isOverLimit('a'.repeat(300))).toBe(false);
    expect(isOverLimit('a'.repeat(301))).toBe(true);
  });
});

describe('GraphemeCounter', () => {
  it('displays count correctly', () => {
    render(<GraphemeCounter text="Hello" max={300} />);
    expect(screen.getByText('5/300')).toBeInTheDocument();
  });

  it('displays correct count for emojis', () => {
    // "Hi!" + US flag emoji = 4 graphemes
    render(<GraphemeCounter text={'Hi!\u{1F1FA}\u{1F1F8}'} max={300} />);
    expect(screen.getByText('4/300')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<GraphemeCounter text="Hello" max={300} />);
    const counter = screen.getByLabelText('5 of 300 characters');
    expect(counter).toBeInTheDocument();
  });

  it('applies default muted style when under threshold', () => {
    const { container } = render(<GraphemeCounter text="Hello" max={300} />);
    expect(container.firstChild).toHaveClass('text-muted-foreground');
  });

  it('applies warning style when approaching limit', () => {
    const { container } = render(<GraphemeCounter text={'a'.repeat(260)} max={300} />);
    expect(container.firstChild).toHaveClass('text-yellow-600');
  });

  it('applies caution style when near limit', () => {
    const { container } = render(<GraphemeCounter text={'a'.repeat(290)} max={300} />);
    expect(container.firstChild).toHaveClass('text-orange-500');
  });

  it('applies error style when over limit', () => {
    const { container } = render(<GraphemeCounter text={'a'.repeat(310)} max={300} />);
    expect(container.firstChild).toHaveClass('text-destructive');
  });
});
