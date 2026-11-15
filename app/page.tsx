import Image from "next/image";
import Link from "next/link";
import { JourneyLine } from "../components/journey-line";
import styles from "./home.module.css";

export default function HomePage() {
  return (
    <main className={styles.home}>
      <div className={styles.scene}>
        <div className={styles.landscape} aria-hidden="true" />
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>
            <Image src="/carecircle-mark.png" width={36} height={36} alt="" unoptimized />
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
            width={192}
            height={192}
            priority
            alt=""
            unoptimized
          />
          <h1 id="home-heading">Make daily care feel a little lighter.</h1>
          <p className={styles.tagline}>One shared place for medications, dose logs, and the people who help.</p>
          <div className={styles.heroActions}>
            <Link href="/create" className={styles.heroPrimary}>Create a profile</Link>
            <Link href="/join" className={styles.heroSecondary}>Join with a passcode</Link>
          </div>
        </section>
      </div>

      <section className={styles.guide} id="how-it-works" aria-labelledby="guide-heading">
        <h2 id="guide-heading">How CareCircle works</h2>
        <JourneyLine>
          <ol className={styles.steps}>
            <li>
              <span className={styles.stepMarker} data-journey-step aria-hidden="true">1</span>
              <h3>Create or join a profile</h3>
              <p>Set up a profile for the person receiving care. If someone has already made one, join with the passcode they gave you.</p>
            </li>
            <li>
              <span className={styles.stepMarker} data-journey-step aria-hidden="true">2</span>
              <h3>See what’s due today</h3>
              <p>Check when each medicine is due. The older adult or caretaker can mark it as taken or skipped.</p>
            </li>
            <li>
              <span className={styles.stepMarker} data-journey-step aria-hidden="true">3</span>
              <h3>Review changes together</h3>
              <p>A caretaker can suggest a schedule change. The older adult decides whether to approve it.</p>
            </li>
          </ol>
        </JourneyLine>
      </section>
    </main>
  );
}
