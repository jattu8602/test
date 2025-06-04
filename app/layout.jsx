import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
})

export const metadata = {
  title: 'ESP32 Attendance System',
  description:
    'Bluetooth-enabled attendance management system with ESP32 integration',
  keywords: ['ESP32', 'Attendance', 'Bluetooth', 'Education', 'IoT'],
  authors: [{ name: 'ESP32 Attendance Team' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'index, follow',
  other: {
    'theme-color': '#3b82f6',
    'color-scheme': 'light',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        <meta httpEquiv="Permissions-Policy" content="bluetooth=*" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full bg-gray-50`}
        suppressHydrationWarning={true}
      >
        <div id="root" className="h-full">
          {children}
        </div>

        <noscript>
          <div className="fixed inset-0 bg-red-50 flex items-center justify-center">
            <div className="text-center p-8">
              <h2 className="text-xl font-bold text-red-800 mb-4">
                JavaScript Required
              </h2>
              <p className="text-red-600">
                This application requires JavaScript to function properly.
                Please enable JavaScript in your browser settings.
              </p>
            </div>
          </div>
        </noscript>
      </body>
    </html>
  )
}
