import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toaster component for displaying toast notifications.
 *
 * Hardcoded to dark theme to match the Vestaboard dark/amber aesthetic.
 * Uses amber-tinted styling consistent with the split-flap display theme.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-neutral-900 group-[.toaster]:text-amber-100 group-[.toaster]:border-neutral-700 group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-neutral-400',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
