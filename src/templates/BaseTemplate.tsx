import Link from 'next/link';
import { AppConfig } from '@/utils/AppConfig';

export const BaseTemplate = (props: {
  leftNav: React.ReactNode;
  rightNav?: React.ReactNode;
  children: React.ReactNode;
}) => {
  return (
    <div className="min-h-screen antialiased" style={{ backgroundColor: '#f7f6f2', color: '#111' }}>
      <header
        className="fixed top-0 left-0 right-0 z-50 border-b border-black/8"
        style={{ backgroundColor: 'rgba(247,246,242,0.88)', backdropFilter: 'blur(14px)' }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex-shrink-0">
            <span className="text-lg font-bold tracking-tight text-gray-950">
              {AppConfig.name.toUpperCase()}
            </span>
          </Link>

          <nav aria-label="Main navigation" className="hidden md:flex">
            <ul className="flex items-center gap-1 text-sm font-medium text-gray-700">
              {props.leftNav}
            </ul>
          </nav>

          <div className="flex items-center gap-2 text-sm">
            {props.rightNav}
          </div>
        </div>
      </header>

      <main className="pt-14">{props.children}</main>

      <footer className="border-t border-gray-200 py-10 text-center text-sm text-gray-500" style={{ backgroundColor: '#f7f6f2' }}>
        {`© ${new Date().getFullYear()} ${AppConfig.name}. All rights reserved.`}
      </footer>
    </div>
  );
};
