/**
 * Navigation Component
 *
 * Responsive navigation with mobile hamburger menu and desktop nav bar
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from './ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { cn } from '../lib/utils';

interface NavigationProps {
  className?: string;
}

// Check if we're in development mode
// Works in both Vite (NODE_ENV set by Vite) and Jest (NODE_ENV=test)
const isDev = process.env.NODE_ENV !== 'production';

const navLinks = [
  { to: '/', label: 'Welcome' },
  { to: '/flipside', label: 'The Flip Side' },
  { to: '/account', label: 'Account' },
  { to: '/login', label: 'Login' },
  // Style Guide only visible in development (and test environments)
  ...(isDev ? [{ to: '/style-guide', label: 'Style Guide' }] : []),
];

/**
 * Navigation provides mobile hamburger menu and desktop horizontal nav
 */
export function Navigation({ className }: NavigationProps) {
  const [open, setOpen] = useState(false);

  return (
    <nav className={cn('bg-gray-800 text-white shadow-lg', className)}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <Link to="/" className="text-xl font-bold hover:text-gray-300 transition-colors">
            Clack Track
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-6">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Mobile Hamburger */}
          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:text-gray-300"
                  aria-label="Open menu"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <SheetHeader>
                  <SheetTitle>Navigation</SheetTitle>
                  <SheetDescription>Browse Clack Track</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-4 mt-6">
                  {navLinks.map(link => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setOpen(false)}
                      className="text-lg hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
