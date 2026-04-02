import type { Metadata } from 'next';
import './globals.css';
import ElectronMenuHandler from './ElectronMenuHandler'; 

export const metadata: Metadata = {
  title: 'Spotix Scanner',
  description: 'Professional Event Check-in System',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ElectronMenuHandler /> 
        {children}
      </body>
    </html>
  );
}