'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ElectronMenuHandler() {
  const router = useRouter();

  useEffect(() => {
    const spotix = (window as any).spotix;
    if (!spotix) return; // not running in Electron, skip

    const unsubNav = spotix.onNavigate((path: string) => {
      router.push(path);
    });

    const unsubAction = spotix.onMenuAction((action: string) => {
      if (action === 'import-guests') {
        spotix.openGuestFileDialog().then((filePath: string | null) => {
          if (filePath) spotix.importGuests(filePath);
        });
      }
      if (action === 'export-logs') spotix.exportLogs('both');
      if (action === 'import-logs') spotix.importLogs();
      if (action === 'end-event')   spotix.endEvent('both');
    });

    return () => {
      unsubNav();
      unsubAction();
    };
  }, [router]);

  return null; // renders nothing, just wires up listeners
}