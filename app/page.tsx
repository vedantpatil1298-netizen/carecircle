import Image from "next/image";
import Link from "next/link";
import { HomeGuide } from "../components/home-guide";
import styles from "./home.module.css";

export default function HomePage() {
  return (
    <main className={styles.home}>
      <div className={styles.scene}>
        <div className={styles.landscape} aria-hidden="true" />
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>
            <Image src="/carecircle-mark.png" width={30} height={30} alt="" unoptimized />
            CareCircle
          </Link>
          <nav className={styles.nav} aria-label="CareCircle">
            <a href="#how-it-works">How it works</a>
            <Link href="/join">Join with a passcode</Link>
          </nav>
          <Link href="/create" className={styles.start}>Create a profile</Link>
        </header>

        <section className={styles.hero} aria-labelledby="home-heading">
          <Image
            src="/carecircle-mark.png"
            className={styles.heroMark}
            width={112}
            height={112}
            priority
            alt=""
            unoptimized
          />
          <h1 id="home-heading">Make daily care feel a little lighter.</h1>
          <p className={styles.tagline}>One shared place for medications, dose logs, and the people who help.</p>
          <HomeGuide />
        </section>
      </div>

      <section className={styles.guide} id="how-it-works" aria-labelledby="guide-heading">
        <h2 id="guide-heading">How CareCircle works</h2>
        <dl>
          <div><dt>Set up a profile</dt><dd>Create one shared space and keep a passcode for each role.</dd></div>
          <div><dt>Keep track of the day</dt><dd>See scheduled doses and what’s been recorded as taken, skipped, or unconfirmed.</dd></div>
          <div><dt>Review changes together</dt><dd>Caretakers can suggest schedule changes for the older adult to review.</dd></div>
        </dl>
      </section>
    </main>
  );
}
