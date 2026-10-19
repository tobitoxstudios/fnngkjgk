import type {Metadata} from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const googleSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-google-sans',
});

export const metadata: Metadata = {
  title: 'ANKA-SİSMİK 3D: Ankara 25 İlçe Deprem ve Altyapı Simülatörü',
  description: 'ABB AYKOME, ASKİ, Başkentgaz, Başkent EDAŞ, EGM ve MEB İSG verilerine dayalı, 30 dakikada bir canlı güncellenen 3B Ankara deprem ve altyapı dayanıklılık simülasyonu.',
  openGraph: {
    title: 'ANKA-SİSMİK 3D: Ankara 25 İlçe Deprem ve Altyapı Simülatörü',
    description: 'ABB AYKOME, ASKİ, Başkentgaz, Başkent EDAŞ, EGM ve MEB İSG verilerine dayalı, 30 dakikada bir canlı güncellenen 3B Ankara deprem ve altyapı dayanıklılık simülasyonu.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ANKA-SİSMİK 3D: Ankara 25 İlçe Deprem ve Altyapı Simülatörü',
    description: 'ABB AYKOME, ASKİ, Başkentgaz, Başkent EDAŞ, EGM ve MEB İSG verilerine dayalı, 30 dakikada bir canlı güncellenen 3B Ankara deprem ve altyapı dayanıklılık simülasyonu.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="tr" className={googleSans.variable}>
      <body suppressHydrationWarning className="font-sans bg-[#0B0E17] text-slate-100 antialiased selection:bg-cyan-500 selection:text-slate-950 overflow-hidden">
        {children}
      </body>
    </html>
  );
}
