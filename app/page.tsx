import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell mx-auto">
      <header className="masthead flex items-center">
        <span className="brand-mark" aria-hidden="true" />
        <span>CareCircle</span>
      </header>

      <div className="hero grid">
        <section className="intro" aria-labelledby="hero-heading">
          <h1 id="hero-heading">Daily care, <em>together.</em></h1>
          <p>
            One shared place for medications and appointments, with the older
            adult deciding what changes to their routine.
          </p>
          <div className="home-actions">
            <Link href="/create" className="button">Create a care profile</Link>
            <Link href="/join" className="button button-secondary">Join with a passcode</Link>
          </div>
        </section>

        <figure className="schedule">
          <figcaption>Example care schedule</figcaption>
          <h2>Today</h2>
          <ol>
            <li>
              <time dateTime="08:00">8:00 AM</time>
              <div>
                <strong>Morning medication</strong>
                <span className="taken">Taken</span>
              </div>
            </li>
            <li>
              <time dateTime="15:00">3:00 PM</time>
              <div>
                <strong>Doctor appointment</strong>
                <span>Upcoming</span>
              </div>
            </li>
          </ol>
        </figure>
      </div>
    </main>
  );
}
