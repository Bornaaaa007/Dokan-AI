import Hero from '../components/Hero';
import Experience from '../components/Experience';
import Stylist from '../components/Stylist';
import TopSellers from '../components/TopSellers';
import Sellers from '../components/Sellers';
import Testimonials from '../components/Testimonials';

export default function Home() {
  return (
    <>
      <main id="top">
        <Hero /><Experience /><Stylist /><TopSellers /><Sellers /><Testimonials />
        <section className="cta"><div className="wrap">
          <h2>Ready to bring your shop out of the inbox?</h2>
          <a className="btn light" href="#sellers">Open your shop – it&apos;s free</a>
        </div></section>
      </main>
    </>
  );
}