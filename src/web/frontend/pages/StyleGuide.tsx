/**
 * StyleGuide Page (/style-guide)
 *
 * Design system documentation displaying typography, fonts,
 * colors, and component styles used throughout the application.
 */

import { useState } from 'react';
import { PageLayout } from '../components/PageLayout';
import { Button } from '../components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../components/ui/sheet';
import { toast } from 'sonner';
import { VestaboardPreview } from '../components/VestaboardPreview';
import { VotingButtons } from '../components/VotingButtons';
import { ContentCard } from '../components/ContentCard';
import type { ContentRecord } from '../../../storage/models/content.js';
import {
  Plus,
  Trash2,
  Settings,
  ChevronRight,
  ExternalLink,
  Star,
  Clock,
  User,
  Menu,
  Mail,
  Lock,
  Search,
} from 'lucide-react';

/**
 * Color swatch component for displaying a single color
 */
function ColorSwatch({
  name,
  cssVar,
  className,
}: {
  name: string;
  cssVar: string;
  className: string;
}) {
  return (
    <div className="flex flex-col">
      <div
        className={`h-16 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}
      />
      <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
        {name}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{cssVar}</p>
    </div>
  );
}

/**
 * Typography showcase section component
 */
function TypographySection() {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
        Typography
      </h2>

      {/* Heading Scale */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Heading Scale
        </h3>
        <div className="space-y-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              text-3xl (Heading 1)
            </span>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Heading 1 - The quick brown fox
            </h1>
          </div>
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              text-2xl (Heading 2)
            </span>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Heading 2 - The quick brown fox
            </h2>
          </div>
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              text-xl (Heading 3)
            </span>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Heading 3 - The quick brown fox
            </h3>
          </div>
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              text-lg (Heading 4)
            </span>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
              Heading 4 - The quick brown fox
            </h4>
          </div>
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              text-base (Heading 5)
            </span>
            <h5 className="text-base font-medium text-gray-900 dark:text-white">
              Heading 5 - The quick brown fox
            </h5>
          </div>
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              text-sm (Heading 6)
            </span>
            <h6 className="text-sm font-medium text-gray-900 dark:text-white">
              Heading 6 - The quick brown fox
            </h6>
          </div>
        </div>
      </div>

      {/* Font Families */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Font Families
        </h3>
        <div className="space-y-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              Inter (Primary - font-sans)
            </span>
            <p className="text-lg font-sans text-gray-900 dark:text-white">
              The quick brown fox jumps over the lazy dog. 0123456789
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              system-ui (Fallback)
            </span>
            <p
              className="text-lg text-gray-900 dark:text-white"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              The quick brown fox jumps over the lazy dog. 0123456789
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              Monospace (font-mono)
            </span>
            <p className="text-lg font-mono text-gray-900 dark:text-white">
              The quick brown fox jumps over the lazy dog. 0123456789
            </p>
          </div>
        </div>
      </div>

      {/* Body Text */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Body Text
        </h3>
        <div className="space-y-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              text-base (Default body)
            </span>
            <p className="text-base text-gray-700 dark:text-gray-300">
              This is the default body text style. It provides comfortable reading for most content.
              The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              text-sm (Small text)
            </span>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This is small body text, useful for captions, footnotes, and secondary information.
              The quick brown fox jumps over the lazy dog.
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              text-xs (Extra small)
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Extra small text for labels, timestamps, and minimal UI elements.
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              text-lg (Large text)
            </span>
            <p className="text-lg text-gray-700 dark:text-gray-300">
              Large body text for emphasis or introductory paragraphs.
              The quick brown fox jumps over the lazy dog.
            </p>
          </div>
        </div>
      </div>

      {/* Code/Monospace */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Code and Monospace
        </h3>
        <div className="space-y-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              Inline code
            </span>
            <p className="text-base text-gray-700 dark:text-gray-300">
              Use <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono text-pink-600 dark:text-pink-400">const</code> for
              constants and <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono text-pink-600 dark:text-pink-400">function</code> for
              function declarations.
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              Code block
            </span>
            <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto">
              <code className="text-sm font-mono">{`const greeting = 'Hello, World!';

function sayHello(name: string): string {
  return \`Hello, \${name}!\`;
}

// Usage
console.log(sayHello('Vestaboard'));`}</code>
            </pre>
          </div>
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              Terminal/Command style
            </span>
            <div className="bg-gray-900 dark:bg-gray-950 text-green-400 p-4 rounded-lg font-mono text-sm">
              <p>$ npm run generate</p>
              <p className="text-gray-400">Generating content...</p>
              <p className="text-green-400">Content sent to Vestaboard successfully!</p>
            </div>
          </div>
        </div>
      </div>

      {/* Text Colors */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Text Colors
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <div>
            <p className="text-gray-900 dark:text-white font-medium">Primary</p>
            <p className="text-xs text-gray-500">gray-900 / white</p>
          </div>
          <div>
            <p className="text-gray-700 dark:text-gray-300">Secondary</p>
            <p className="text-xs text-gray-500">gray-700 / gray-300</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Muted</p>
            <p className="text-xs text-gray-500">gray-500 / gray-400</p>
          </div>
          <div>
            <p className="text-blue-600 dark:text-blue-400">Link</p>
            <p className="text-xs text-gray-500">blue-600 / blue-400</p>
          </div>
          <div>
            <p className="text-green-600 dark:text-green-400">Success</p>
            <p className="text-xs text-gray-500">green-600 / green-400</p>
          </div>
          <div>
            <p className="text-red-600 dark:text-red-400">Error</p>
            <p className="text-xs text-gray-500">red-600 / red-400</p>
          </div>
          <div>
            <p className="text-yellow-600 dark:text-yellow-400">Warning</p>
            <p className="text-xs text-gray-500">yellow-600 / yellow-400</p>
          </div>
          <div>
            <p className="text-purple-600 dark:text-purple-400">Accent</p>
            <p className="text-xs text-gray-500">purple-600 / purple-400</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Colors showcase section component
 */
function ColorsSection() {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
        Colors
      </h2>

      {/* Core Colors */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Core Theme Colors
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <ColorSwatch
            name="Background"
            cssVar="--background"
            className="bg-background"
          />
          <ColorSwatch
            name="Foreground"
            cssVar="--foreground"
            className="bg-foreground"
          />
          <ColorSwatch
            name="Primary"
            cssVar="--primary"
            className="bg-primary"
          />
          <ColorSwatch
            name="Primary Foreground"
            cssVar="--primary-foreground"
            className="bg-primary-foreground"
          />
          <ColorSwatch
            name="Secondary"
            cssVar="--secondary"
            className="bg-secondary"
          />
          <ColorSwatch
            name="Secondary Foreground"
            cssVar="--secondary-foreground"
            className="bg-secondary-foreground"
          />
          <ColorSwatch name="Muted" cssVar="--muted" className="bg-muted" />
          <ColorSwatch
            name="Muted Foreground"
            cssVar="--muted-foreground"
            className="bg-muted-foreground"
          />
        </div>
      </div>

      {/* Accent & Destructive */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Accent & Semantic Colors
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <ColorSwatch name="Accent" cssVar="--accent" className="bg-accent" />
          <ColorSwatch
            name="Accent Foreground"
            cssVar="--accent-foreground"
            className="bg-accent-foreground"
          />
          <ColorSwatch
            name="Destructive"
            cssVar="--destructive"
            className="bg-destructive"
          />
          <ColorSwatch name="Ring" cssVar="--ring" className="bg-ring" />
        </div>
      </div>

      {/* Card & Popover */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Card & Popover Colors
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <ColorSwatch name="Card" cssVar="--card" className="bg-card" />
          <ColorSwatch
            name="Card Foreground"
            cssVar="--card-foreground"
            className="bg-card-foreground"
          />
          <ColorSwatch
            name="Popover"
            cssVar="--popover"
            className="bg-popover"
          />
          <ColorSwatch
            name="Popover Foreground"
            cssVar="--popover-foreground"
            className="bg-popover-foreground"
          />
        </div>
      </div>

      {/* Border & Input */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Border & Input Colors
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <ColorSwatch name="Border" cssVar="--border" className="bg-border" />
          <ColorSwatch name="Input" cssVar="--input" className="bg-input" />
        </div>
      </div>

      {/* Chart Colors */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Chart Colors
        </h3>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <ColorSwatch
            name="Chart 1"
            cssVar="--chart-1"
            className="bg-chart-1"
          />
          <ColorSwatch
            name="Chart 2"
            cssVar="--chart-2"
            className="bg-chart-2"
          />
          <ColorSwatch
            name="Chart 3"
            cssVar="--chart-3"
            className="bg-chart-3"
          />
          <ColorSwatch
            name="Chart 4"
            cssVar="--chart-4"
            className="bg-chart-4"
          />
          <ColorSwatch
            name="Chart 5"
            cssVar="--chart-5"
            className="bg-chart-5"
          />
        </div>
      </div>

      {/* Sidebar Colors */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Sidebar Colors
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <ColorSwatch
            name="Sidebar"
            cssVar="--sidebar"
            className="bg-sidebar"
          />
          <ColorSwatch
            name="Sidebar Foreground"
            cssVar="--sidebar-foreground"
            className="bg-sidebar-foreground"
          />
          <ColorSwatch
            name="Sidebar Primary"
            cssVar="--sidebar-primary"
            className="bg-sidebar-primary"
          />
          <ColorSwatch
            name="Sidebar Accent"
            cssVar="--sidebar-accent"
            className="bg-sidebar-accent"
          />
        </div>
      </div>

      {/* Light/Dark Mode Comparison */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Light/Dark Mode Comparison
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Light Mode Preview */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-900 mb-4">Light Mode</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[oklch(1_0_0)]" />
                <span className="text-xs text-gray-600">Background</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[oklch(0.145_0_0)]" />
                <span className="text-xs text-gray-600">Foreground</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[oklch(0.205_0_0)]" />
                <span className="text-xs text-gray-600">Primary</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[oklch(0.577_0.245_27.325)]" />
                <span className="text-xs text-gray-600">Destructive</span>
              </div>
            </div>
          </div>

          {/* Dark Mode Preview */}
          <div className="bg-[oklch(0.145_0_0)] p-6 rounded-lg border border-gray-700">
            <p className="text-sm font-medium text-white mb-4">Dark Mode</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[oklch(0.145_0_0)] border border-gray-600" />
                <span className="text-xs text-gray-300">Background</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[oklch(0.985_0_0)]" />
                <span className="text-xs text-gray-300">Foreground</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[oklch(0.922_0_0)]" />
                <span className="text-xs text-gray-300">Primary</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[oklch(0.704_0.191_22.216)]" />
                <span className="text-xs text-gray-300">Destructive</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Buttons showcase section component
 */
function ButtonsSection() {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
        Buttons
      </h2>

      {/* All Variants */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Button Variants
        </h3>
        <div className="flex flex-wrap gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <Button variant="default">Default</Button>
            <span className="text-xs text-gray-500">default</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button variant="destructive">Destructive</Button>
            <span className="text-xs text-gray-500">destructive</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button variant="outline">Outline</Button>
            <span className="text-xs text-gray-500">outline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button variant="secondary">Secondary</Button>
            <span className="text-xs text-gray-500">secondary</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button variant="ghost">Ghost</Button>
            <span className="text-xs text-gray-500">ghost</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button variant="link">Link</Button>
            <span className="text-xs text-gray-500">link</span>
          </div>
        </div>
      </div>

      {/* All Sizes */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Button Sizes
        </h3>
        <div className="flex flex-wrap items-end gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <Button size="sm">Small</Button>
            <span className="text-xs text-gray-500">sm</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button size="default">Default</Button>
            <span className="text-xs text-gray-500">default</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button size="lg">Large</Button>
            <span className="text-xs text-gray-500">lg</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button size="icon">
              <Plus />
            </Button>
            <span className="text-xs text-gray-500">icon</span>
          </div>
        </div>
      </div>

      {/* Disabled States */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Disabled States
        </h3>
        <div className="flex flex-wrap gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <Button variant="default" disabled>
            Default
          </Button>
          <Button variant="destructive" disabled>
            Destructive
          </Button>
          <Button variant="outline" disabled>
            Outline
          </Button>
          <Button variant="secondary" disabled>
            Secondary
          </Button>
          <Button variant="ghost" disabled>
            Ghost
          </Button>
          <Button variant="link" disabled>
            Link
          </Button>
        </div>
      </div>

      {/* With Icons */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          With Icons
        </h3>
        <div className="flex flex-wrap gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <Button>
            <Plus />
            Add Item
          </Button>
          <Button variant="destructive">
            <Trash2 />
            Delete
          </Button>
          <Button variant="outline">
            <Settings />
            Settings
          </Button>
          <Button variant="secondary">
            Next
            <ChevronRight />
          </Button>
          <Button variant="link">
            Open Link
            <ExternalLink />
          </Button>
        </div>
      </div>

      {/* Icon-only Buttons */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Icon-only Buttons
        </h3>
        <div className="flex flex-wrap gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <Button size="icon" variant="default">
              <Plus />
            </Button>
            <span className="text-xs text-gray-500">default</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button size="icon" variant="destructive">
              <Trash2 />
            </Button>
            <span className="text-xs text-gray-500">destructive</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button size="icon" variant="outline">
              <Settings />
            </Button>
            <span className="text-xs text-gray-500">outline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button size="icon" variant="secondary">
              <ChevronRight />
            </Button>
            <span className="text-xs text-gray-500">secondary</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button size="icon" variant="ghost">
              <ExternalLink />
            </Button>
            <span className="text-xs text-gray-500">ghost</span>
          </div>
        </div>
      </div>

      {/* Size × Variant Matrix */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Size × Variant Matrix
        </h3>
        <div className="overflow-x-auto bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-xs text-gray-500 pb-4">Size</th>
                <th className="text-center text-xs text-gray-500 pb-4">
                  default
                </th>
                <th className="text-center text-xs text-gray-500 pb-4">
                  destructive
                </th>
                <th className="text-center text-xs text-gray-500 pb-4">
                  outline
                </th>
                <th className="text-center text-xs text-gray-500 pb-4">
                  secondary
                </th>
                <th className="text-center text-xs text-gray-500 pb-4">
                  ghost
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-xs text-gray-500 py-2">sm</td>
                <td className="text-center py-2">
                  <Button size="sm" variant="default">
                    Btn
                  </Button>
                </td>
                <td className="text-center py-2">
                  <Button size="sm" variant="destructive">
                    Btn
                  </Button>
                </td>
                <td className="text-center py-2">
                  <Button size="sm" variant="outline">
                    Btn
                  </Button>
                </td>
                <td className="text-center py-2">
                  <Button size="sm" variant="secondary">
                    Btn
                  </Button>
                </td>
                <td className="text-center py-2">
                  <Button size="sm" variant="ghost">
                    Btn
                  </Button>
                </td>
              </tr>
              <tr>
                <td className="text-xs text-gray-500 py-2">default</td>
                <td className="text-center py-2">
                  <Button size="default" variant="default">
                    Button
                  </Button>
                </td>
                <td className="text-center py-2">
                  <Button size="default" variant="destructive">
                    Button
                  </Button>
                </td>
                <td className="text-center py-2">
                  <Button size="default" variant="outline">
                    Button
                  </Button>
                </td>
                <td className="text-center py-2">
                  <Button size="default" variant="secondary">
                    Button
                  </Button>
                </td>
                <td className="text-center py-2">
                  <Button size="default" variant="ghost">
                    Button
                  </Button>
                </td>
              </tr>
              <tr>
                <td className="text-xs text-gray-500 py-2">lg</td>
                <td className="text-center py-2">
                  <Button size="lg" variant="default">
                    Button
                  </Button>
                </td>
                <td className="text-center py-2">
                  <Button size="lg" variant="destructive">
                    Button
                  </Button>
                </td>
                <td className="text-center py-2">
                  <Button size="lg" variant="outline">
                    Button
                  </Button>
                </td>
                <td className="text-center py-2">
                  <Button size="lg" variant="secondary">
                    Button
                  </Button>
                </td>
                <td className="text-center py-2">
                  <Button size="lg" variant="ghost">
                    Button
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/**
 * Cards and Badges showcase section component
 */
function CardsAndBadgesSection() {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
        Cards & Badges
      </h2>

      {/* Badge Variants */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Badge Variants
        </h3>
        <div className="flex flex-wrap gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <Badge variant="default">Default</Badge>
            <span className="text-xs text-gray-500">default</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Badge variant="secondary">Secondary</Badge>
            <span className="text-xs text-gray-500">secondary</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Badge variant="destructive">Destructive</Badge>
            <span className="text-xs text-gray-500">destructive</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Badge variant="outline">Outline</Badge>
            <span className="text-xs text-gray-500">outline</span>
          </div>
        </div>
      </div>

      {/* Badges with Icons */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Badges with Icons
        </h3>
        <div className="flex flex-wrap gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <Badge variant="default" className="gap-1">
            <Star className="h-3 w-3" />
            Featured
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
          <Badge variant="destructive" className="gap-1">
            <Trash2 className="h-3 w-3" />
            Deleted
          </Badge>
          <Badge variant="outline" className="gap-1">
            <User className="h-3 w-3" />
            User
          </Badge>
        </div>
      </div>

      {/* Full Card Example */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Full Card Composition
        </h3>
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <Card className="max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Card Title</CardTitle>
                <Badge variant="secondary">New</Badge>
              </div>
              <CardDescription>
                This is the card description that provides additional context
                about the card content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                This is the main content area of the card. It can contain any
                type of content including text, images, or other components.
              </p>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Cancel</Button>
              <Button>Submit</Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Card Grid */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Card Grid Layout
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Simple Card</CardTitle>
              <CardDescription>Basic card with header</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Minimal content example.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">With Badges</CardTitle>
                <Badge variant="default">Hot</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Tag 1</Badge>
                <Badge variant="secondary">Tag 2</Badge>
                <Badge variant="outline">Tag 3</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Action Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Card with action button.
              </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" size="sm">
                Take Action
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Stacked Cards */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Stacked Cards
        </h3>
        <div className="space-y-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <Card>
            <CardHeader className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Item One</CardTitle>
                  <CardDescription>Description for item one</CardDescription>
                </div>
                <Badge variant="default">Active</Badge>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Item Two</CardTitle>
                  <CardDescription>Description for item two</CardDescription>
                </div>
                <Badge variant="secondary">Pending</Badge>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Item Three</CardTitle>
                  <CardDescription>Description for item three</CardDescription>
                </div>
                <Badge variant="destructive">Expired</Badge>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    </section>
  );
}

/**
 * Forms and Interactive components showcase section
 */
function FormsSection() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <section className="mb-12">
      <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
        Forms & Interactive
      </h2>

      {/* Input States */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Input States
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
              Default
            </label>
            <Input placeholder="Enter text..." />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
              With Value
            </label>
            <Input defaultValue="Hello, World!" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
              Disabled
            </label>
            <Input placeholder="Disabled input" disabled />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
              With Error (styled)
            </label>
            <Input
              placeholder="Invalid input"
              className="border-red-500 focus-visible:ring-red-500"
            />
            <p className="text-xs text-red-500 mt-1">
              This field is required
            </p>
          </div>
        </div>
      </div>

      {/* Input Types */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Input Types
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
              Text
            </label>
            <Input type="text" placeholder="Text input" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
              Email
            </label>
            <Input type="email" placeholder="email@example.com" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
              Password
            </label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
              Number
            </label>
            <Input type="number" placeholder="0" />
          </div>
        </div>
      </div>

      {/* Input with Icons */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Input with Icons
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
              With Leading Icon
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input className="pl-10" placeholder="Search..." />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
              Email with Icon
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input className="pl-10" type="email" placeholder="email@example.com" />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
              Password with Icon
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input className="pl-10" type="password" placeholder="••••••••" />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
              With Button
            </label>
            <div className="flex gap-2">
              <Input placeholder="Enter value" />
              <Button>Submit</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Separator
        </h3>
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Horizontal Separator
          </p>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">Content above</p>
            <Separator />
            <p className="text-gray-700 dark:text-gray-300">Content below</p>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 mt-8">
            Vertical Separator
          </p>
          <div className="flex items-center gap-4 h-8">
            <span className="text-gray-700 dark:text-gray-300">Item 1</span>
            <Separator orientation="vertical" />
            <span className="text-gray-700 dark:text-gray-300">Item 2</span>
            <Separator orientation="vertical" />
            <span className="text-gray-700 dark:text-gray-300">Item 3</span>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 mt-8">
            With Text
          </p>
          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-xs text-gray-500">OR</span>
            <Separator className="flex-1" />
          </div>
        </div>
      </div>

      {/* Sheet/Modal */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Sheet (Slide-out Panel)
        </h3>
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <div className="flex flex-wrap gap-4">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline">
                  <Menu className="mr-2 h-4 w-4" />
                  Open Sheet (Right)
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Sheet Title</SheetTitle>
                  <SheetDescription>
                    This is a sheet component that slides in from the side.
                    It&apos;s commonly used for mobile navigation or detail views.
                  </SheetDescription>
                </SheetHeader>
                <div className="py-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Sheet content goes here. You can put any content inside.
                  </p>
                  <div className="space-y-2">
                    <Button className="w-full" variant="outline">
                      Option 1
                    </Button>
                    <Button className="w-full" variant="outline">
                      Option 2
                    </Button>
                    <Button className="w-full" variant="outline">
                      Option 3
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Click the button above to see the Sheet component in action.
            The Sheet slides in from the right side of the screen.
          </p>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          Toast Notifications (Sonner)
        </h3>
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <div className="flex flex-wrap gap-4">
            <Button
              variant="default"
              onClick={() => toast.success('Success! Operation completed.')}
            >
              Success Toast
            </Button>
            <Button
              variant="destructive"
              onClick={() => toast.error('Error! Something went wrong.')}
            >
              Error Toast
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.info('Info: This is informational.')}
            >
              Info Toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast.warning('Warning: Please check this.')}
            >
              Warning Toast
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                toast('Custom Toast', {
                  description: 'With a description below the title.',
                  action: {
                    label: 'Undo',
                    onClick: () => console.log('Undo clicked'),
                  },
                })
              }
            >
              Toast with Action
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Click the buttons above to trigger different toast notifications.
            Toasts appear at the bottom-right of the screen.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Sample Vestaboard content for demonstrations
 * Spells "HELLO WORLD" on the first two rows
 */
const SAMPLE_VESTABOARD_CONTENT: number[][] = [
  [0, 0, 0, 0, 0, 8, 5, 12, 12, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 23, 15, 18, 12, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 6, 18, 15, 13, 0, 3, 12, 1, 3, 11, 0, 20, 18, 1, 3, 11, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 28, 50, 30, 31, 0, 16, 13, 0, 0, 0, 0, 0, 0, 0, 0, 32, 31, 62, 6, 0, 0],
];

/**
 * Sample content record for ContentCard demonstration
 */
const SAMPLE_CONTENT_RECORD: ContentRecord = {
  id: 1,
  text: 'HELLO WORLD\n\nFROM CLACK TRACK\n\n2:45 PM         67°F',
  characterCodes: JSON.stringify(SAMPLE_VESTABOARD_CONTENT),
  generatedAt: new Date(),
  type: 'major',
  generatorId: 'haiku-generator',
  aiProvider: 'openai',
  aiModel: 'gpt-4.1-mini',
  tokensUsed: 150,
};

/**
 * Feature components showcase section
 */
function FeatureComponentsSection() {
  const [votingLoading, setVotingLoading] = useState(false);

  const handleVote = (vote: 'good' | 'bad') => {
    setVotingLoading(true);
    toast.success(`Voted: ${vote}`);
    setTimeout(() => setVotingLoading(false), 1000);
  };

  return (
    <section className="mb-12">
      <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
        Feature Components
      </h2>

      {/* VestaboardPreview */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          VestaboardPreview
        </h3>
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Displays Vestaboard content in a 6×22 character grid with split-flap
            aesthetic. Amber text on black background mimics the physical board.
          </p>
          <VestaboardPreview content={SAMPLE_VESTABOARD_CONTENT} />
          <div className="mt-4 text-xs text-gray-500">
            <p>
              <strong>Props:</strong> content: number[][] (6×22 character codes),
              className?: string
            </p>
            <p className="mt-1">
              <strong>Character codes:</strong> 0=blank, 1-26=A-Z, 27=1, 28=2...
              36=0, 37-62=symbols
            </p>
          </div>
        </div>
      </div>

      {/* VotingButtons */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          VotingButtons
        </h3>
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Touch-friendly voting interface for content quality rating. Large
            44px+ touch targets for mobile accessibility.
          </p>

          <div className="space-y-6">
            <div>
              <p className="text-xs text-gray-500 mb-2">Default State</p>
              <VotingButtons onVote={handleVote} />
            </div>

            <Separator />

            <div>
              <p className="text-xs text-gray-500 mb-2">Loading State</p>
              <VotingButtons onVote={handleVote} isLoading={true} />
            </div>

            <Separator />

            <div>
              <p className="text-xs text-gray-500 mb-2">
                Interactive (click to test)
              </p>
              <VotingButtons onVote={handleVote} isLoading={votingLoading} />
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            <p>
              <strong>Props:</strong> onVote: (vote: &apos;good&apos; | &apos;bad&apos;) =&gt; void,
              isLoading?: boolean, className?: string
            </p>
          </div>
        </div>
      </div>

      {/* ContentCard */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          ContentCard
        </h3>
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Card component for displaying content records with metadata badges
            showing generator, type, provider, model, and token usage.
          </p>

          <div className="max-w-md">
            <ContentCard
              content={SAMPLE_CONTENT_RECORD}
              onClick={() => toast.info('Card clicked!')}
            />
          </div>

          <div className="mt-4 text-xs text-gray-500">
            <p>
              <strong>Props:</strong> content: ContentRecord, onClick?: () =&gt;
              void, className?: string
            </p>
            <p className="mt-1">
              <strong>Displays:</strong> generatorId, type badge (major/minor),
              aiProvider, aiModel, tokensUsed, truncated content preview
            </p>
          </div>
        </div>
      </div>

      {/* ContentCard Variants */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
          ContentCard Variants
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <ContentCard
            content={{
              ...SAMPLE_CONTENT_RECORD,
              id: 2,
              type: 'major',
              generatorId: 'news-summary',
              aiProvider: 'anthropic',
              aiModel: 'claude-sonnet-4.5',
              tokensUsed: 250,
            }}
          />
          <ContentCard
            content={{
              ...SAMPLE_CONTENT_RECORD,
              id: 3,
              type: 'minor',
              generatorId: 'weather-focus',
              aiProvider: 'openai',
              aiModel: 'gpt-4.1-nano',
              tokensUsed: 50,
            }}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * StyleGuide page component
 */
export function StyleGuide() {
  return (
    <PageLayout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          Style Guide
        </h1>

        <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
          Design system documentation for Clack Track
        </p>

        <TypographySection />

        <ColorsSection />

        <ButtonsSection />

        <CardsAndBadgesSection />

        <FormsSection />

        <FeatureComponentsSection />
      </div>
    </PageLayout>
  );
}

export default StyleGuide;
