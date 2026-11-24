import './globals.css';
import { LangProvider } from '../components/LangProvider';
import { AuthProvider } from '../components/AuthProvider';
import { StoreProvider } from '../components/Store';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export const metadata = {
  title: 'Dokan AI – Your shop. Your stylist. Your trust.',
  description: 'A marketplace for small fashion sellers in Bangladesh, with an AI stylist that builds complete outfits within your budget.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600&family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet" />
      </head>
      <body><LangProvider><AuthProvider><StoreProvider><Navbar />{children}<Footer /></StoreProvider></AuthProvider></LangProvider></body>
    </html>
  );
}