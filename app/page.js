import Hero from '../components/Hero';
import Pillars from '../components/Pillars';
import Stylist from '../components/Stylist';
import Sellers from '../components/Sellers';


export default function Home() {
  return (
    <>
            <main id="top">
        <Hero /><Pillars /><Stylist /><Sellers />
        <section className="cta"><div className="wrap">
          <h2>Ready to bring your shop out of the inbox?</h2>
          <a className="btn light" href="#sellers">Open your shop – it&apos;s free</a>
        </div></section>
      </main>
    </>
  );
}
