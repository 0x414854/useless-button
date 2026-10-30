"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { translations, detectLanguage } from "@/utils/translations";

const LEADERBOARD_TABS = ["visitors", "daily", "countries"];

const EMPTY_VIEWER = {
  topVisitors: null,
  daily: null,
  countryCode: null,
};

function getBrowserId() {
  const storageKey = "useless-browser-id";

  try {
    const saved = window.localStorage.getItem(storageKey);

    if (
      saved &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        saved,
      )
    ) {
      return saved;
    }
  } catch {}

  if (!window.crypto?.randomUUID) {
    throw new Error("Impossible de créer un identifiant anonyme.");
  }

  const id = window.crypto.randomUUID();

  try {
    window.localStorage.setItem(storageKey, id);
  } catch {}

  return id;
}

function getCountryName(code, language) {
  if (!code) return "Inconnu";

  try {
    return (
      new Intl.DisplayNames([language], { type: "region" }).of(code) || code
    );
  } catch {
    return code;
  }
}

export default function Home() {
  const [clicks, setClicks] = useState(0);
  const [browserId, setBrowserId] = useState(null);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [globalClicks, setGlobalClicks] = useState(null);
  const [globalError, setGlobalError] = useState(false);
  const [sending, setSending] = useState(false);
  const [language, setLanguage] = useState("fr");
  const [introDone, setIntroDone] = useState(false);

  const [leaderboardTab, setLeaderboardTab] = useState("visitors");

  const [leaderboards, setLeaderboards] = useState({
    topVisitors: [],
    daily: [],
    countries: [],
  });

  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState(false);

  const [viewer, setViewer] = useState(EMPTY_VIEWER);

  const t = translations[language] || translations.fr;
  const isFrench = language === "fr";

  const leaderboardText = isFrench
    ? {
        title: "Les classements",
        subtitle: "L'inutile devient compétitif.",
        visitors: "Top visiteurs",
        daily: "Aujourd'hui",
        countries: "Par pays",
        visitor: "Visiteur",
        clicks: "clics",
        noData: "Pas encore de clics à classer.",
        loading: "Chargement des classements…",
        error: "Les classements sont momentanément indisponibles.",
        refresh: "Actualisés automatiquement",
        rank: "Rang",
        country: "Pays",
        yourRank: "TON CLASSEMENT",
        you: "Toi — visiteur anonyme",
        notRanked: "Pas encore classé aujourd'hui.",
      }
    : {
        title: "Leaderboards",
        subtitle: "Making uselessness competitive.",
        visitors: "Top visitors",
        daily: "Today",
        countries: "By country",
        visitor: "Visitor",
        clicks: "clicks",
        noData: "No clicks to rank yet.",
        loading: "Loading leaderboards…",
        error: "Leaderboards are temporarily unavailable.",
        refresh: "Automatically refreshed",
        rank: "Rank",
        country: "Country",
        yourRank: "YOUR RANK",
        you: "You — anonymous visitor",
        notRanked: "Not ranked today yet.",
      };

  // Applique les données reçues de l'API.
  function applyLeaderboardData(data) {
    setLeaderboards({
      topVisitors: Array.isArray(data.topVisitors) ? data.topVisitors : [],
      daily: Array.isArray(data.daily) ? data.daily : [],
      countries: Array.isArray(data.countries) ? data.countries : [],
    });

    setViewer(data.viewer || EMPTY_VIEWER);
    setLeaderboardError(false);
  }

  // Initialise la langue et les données du navigateur.
  useEffect(() => {
    const detectedLanguage = detectLanguage();

    const currentTranslations =
      translations[detectedLanguage] || translations.en || translations.fr;

    setLanguage(detectedLanguage);
    setMessage(currentTranslations.initialMessage || "");

    try {
      const saved = Number(window.localStorage.getItem("useless-clicks") || 0);

      setClicks(Number.isSafeInteger(saved) && saved >= 0 ? saved : 0);

      setBrowserId(getBrowserId());
    } catch (error) {
      console.error("Initialisation du navigateur impossible:", error);
      setGlobalError(true);
    } finally {
      setReady(true);
    }
  }, []);

  // Gère l'intro et respecte les préférences d'accessibilité.
  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) {
      setIntroDone(true);
      return;
    }

    const timeout = window.setTimeout(() => {
      setIntroDone(true);
    }, 2800);

    return () => window.clearTimeout(timeout);
  }, []);

  // Charge le compteur global et le rafraîchit toutes les 10 secondes.
  useEffect(() => {
    let active = true;

    async function loadGlobalClicks() {
      try {
        const response = await fetch("/api/clicks", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Lecture impossible");
        }

        if (active) {
          setGlobalClicks(data.total);
          setGlobalError(false);
        }
      } catch {
        if (active) {
          setGlobalError(true);
        }
      }
    }

    loadGlobalClicks();

    const interval = window.setInterval(loadGlobalClicks, 10000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  // Charge les classements et la position du visiteur.
  useEffect(() => {
    if (!browserId) return;

    let active = true;

    async function loadLeaderboards() {
      try {
        const response = await fetch(
          `/api/leaderboards?browserId=${encodeURIComponent(browserId)}`,
          { cache: "no-store" },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Lecture impossible");
        }

        if (active) {
          applyLeaderboardData(data);
        }
      } catch (error) {
        console.error("Chargement des classements impossible:", error);

        if (active) {
          setLeaderboardError(true);
        }
      } finally {
        if (active) {
          setLeaderboardLoading(false);
        }
      }
    }

    loadLeaderboards();

    const interval = window.setInterval(loadLeaderboards, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [browserId]);

  // Enregistre un clic.
  async function handleClick() {
    if (!browserId || sending) return;

    setSending(true);

    const messages = t.messages || translations.fr.messages || [];

    if (messages.length > 0) {
      setMessage(messages[Math.floor(Math.random() * messages.length)]);
    }

    try {
      const response = await fetch("/api/clicks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ browserId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Clic refusé");
      }

      setGlobalClicks(data.total);
      setGlobalError(false);

      const nextClicks = clicks + 1;
      setClicks(nextClicks);

      try {
        window.localStorage.setItem("useless-clicks", String(nextClicks));
      } catch {}

      // Recharge les classements et le rang personnel.
      try {
        const rankingResponse = await fetch(
          `/api/leaderboards?browserId=${encodeURIComponent(browserId)}`,
          { cache: "no-store" },
        );

        const rankingData = await rankingResponse.json();

        if (!rankingResponse.ok) {
          throw new Error(rankingData.error || "Actualisation impossible");
        }

        applyLeaderboardData(rankingData);
      } catch (error) {
        console.error("Actualisation des classements impossible:", error);
      }
    } catch (error) {
      console.error("Enregistrement du clic impossible:", error);

      setGlobalError(true);

      setMessage(
        t.clickError || "Le néant ne répond pas. Réessaie dans un instant.",
      );
    } finally {
      setSending(false);
    }
  }

  // Partage le score du visiteur.
  async function handleShare() {
    const text =
      typeof t.shareText === "function"
        ? t.shareText(clicks)
        : `J'ai cliqué ${clicks} fois sur un bouton inutile.`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: t.shareTitle || t.logo,
          text,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(`${text} ${window.location.href}`);

        setCopied(true);

        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        setMessage(
          t.shareFailed || "Le partage a échoué. Même lui est inutile.",
        );
      }
    }
  }

  // Détermine les données de l'onglet actuellement sélectionné.
  const currentRows =
    leaderboardTab === "visitors"
      ? leaderboards.topVisitors
      : leaderboardTab === "daily"
        ? leaderboards.daily
        : leaderboards.countries;

  // Position personnelle selon le classement affiché.
  const viewerEntry =
    leaderboardTab === "visitors"
      ? viewer.topVisitors
      : leaderboardTab === "daily"
        ? viewer.daily
        : null;

  const viewerRank = viewerEntry?.rank ? Number(viewerEntry.rank) : null;

  // Affiche une ligne séparée uniquement si le visiteur
  // se trouve au-delà de la dixième position.
  const showViewerSeparately =
    leaderboardTab !== "countries" && viewerRank !== null && viewerRank > 10;

  // Détermine si la ligne du top 10 correspond au visiteur.
  function isCurrentViewer(entry, rank) {
    if (leaderboardTab === "visitors") {
      return Number(viewer.topVisitors?.rank) === rank;
    }

    if (leaderboardTab === "daily") {
      return Number(viewer.daily?.rank) === rank;
    }

    if (leaderboardTab === "countries") {
      return (
        Boolean(viewer.countryCode) && viewer.countryCode === entry.countryCode
      );
    }

    return false;
  }

  return (
    <>
      <main
        className={`${styles.page} ${styles.pageEntering}`}
        aria-busy={!introDone}
      >
        <header className={styles.header}>
          <a className={styles.logo} href="/">
            {t.logo}
            <span>.</span>
          </a>

          <span className={styles.version}>{t.version}</span>
        </header>

        <section className={styles.hero}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>{t.eyebrow}</p>

            <h1>
              {t.titleLine1}
              <br />
              {t.titleLine2}
              <span>.</span>
            </h1>

            <p className={styles.subtitle}>{t.subtitle}</p>
          </div>

          <div className={styles.buttonArea}>
            <span className={styles.buttonHint}>{t.buttonHint}</span>

            <button
              className={styles.button}
              onClick={handleClick}
              disabled={!ready || !browserId || sending}
              aria-label={t.buttonAriaLabel || t.click}
            >
              <span>{sending ? "..." : t.click}</span>
              <small>{t.forNothing}</small>
            </button>

            <span className={styles.buttonFootnote}>
              {sending ? t.sending : t.buttonFootnote}
            </span>
          </div>

          <section className={styles.stats} aria-label="Statistiques des clics">
            <article className={`${styles.statCard} ${styles.globalStat}`}>
              <div className={styles.statTop}>
                <span className={styles.statDot} />
                <span className={styles.statLabel}>{t.world}</span>
              </div>

              <p className={styles.statNumber}>
                {globalClicks === null
                  ? "—"
                  : globalClicks.toLocaleString(language)}
              </p>

              <p className={styles.statCaption}>{t.worldCaption}</p>

              <span className={styles.statTag}>{t.everyone}</span>
            </article>

            <article className={`${styles.statCard} ${styles.personalStat}`}>
              <div className={styles.statTop}>
                <span className={styles.personalIcon}>↗</span>
                <span className={styles.statLabel}>{t.personal}</span>
              </div>

              <p className={styles.statNumber}>
                {clicks.toLocaleString(language)}
              </p>

              <p className={styles.statCaption}>{t.personalCaption}</p>

              <span className={styles.statTag}>{t.thisBrowser}</span>
            </article>
          </section>

          {/* CLASSEMENTS */}

          <section
            className={styles.leaderboards}
            aria-labelledby="leaderboard-title"
          >
            <div className={styles.leaderboardHeading}>
              <p className={styles.eyebrow}>{leaderboardText.rank}</p>

              <h2 id="leaderboard-title">{leaderboardText.title}</h2>

              <p>{leaderboardText.subtitle}</p>
            </div>

            <div
              className={styles.leaderboardTabs}
              role="tablist"
              aria-label={leaderboardText.title}
            >
              {LEADERBOARD_TABS.map((tab) => {
                const label =
                  tab === "visitors"
                    ? leaderboardText.visitors
                    : tab === "daily"
                      ? leaderboardText.daily
                      : leaderboardText.countries;

                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    id={`tab-${tab}`}
                    aria-selected={leaderboardTab === tab}
                    aria-controls="leaderboard-panel"
                    className={`${styles.leaderboardTab} ${
                      leaderboardTab === tab ? styles.activeTab : ""
                    }`}
                    onClick={() => setLeaderboardTab(tab)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div
              className={styles.leaderboardPanel}
              id="leaderboard-panel"
              role="tabpanel"
              aria-labelledby={`tab-${leaderboardTab}`}
            >
              {leaderboardLoading ? (
                <p className={styles.leaderboardNotice}>
                  {leaderboardText.loading}
                </p>
              ) : leaderboardError ? (
                <p className={styles.leaderboardNotice} role="status">
                  {leaderboardText.error}
                </p>
              ) : currentRows.length === 0 ? (
                <p className={styles.leaderboardNotice}>
                  {leaderboardText.noData}
                </p>
              ) : (
                <ol className={styles.leaderboardList}>
                  {currentRows.map((entry, index) => {
                    const isCountry = leaderboardTab === "countries";

                    const rank = Number(entry.rank) || index + 1;

                    const label = isCountry
                      ? getCountryName(entry.countryCode, language)
                      : `${leaderboardText.visitor} #${rank}`;

                    const count = Number(entry.clicks) || 0;

                    const isViewer = isCurrentViewer(entry, rank);

                    return (
                      <li
                        key={
                          isCountry
                            ? entry.countryCode
                            : `${leaderboardTab}-${rank}`
                        }
                        className={`${styles.leaderboardRow} ${
                          rank <= 3 ? styles.topThree : ""
                        } ${isViewer ? styles.currentViewerRow : ""}`}
                      >
                        <span className={styles.leaderboardRank}>
                          {String(rank).padStart(2, "0")}
                        </span>

                        <span className={styles.leaderboardName}>
                          {isCountry && (
                            <span className={styles.countryCode}>
                              {entry.countryCode}
                            </span>
                          )}

                          {label}

                          {isViewer && (
                            <small className={styles.youLabel}>
                              {isFrench ? "C'est toi" : "You"}
                            </small>
                          )}
                        </span>

                        <span className={styles.leaderboardScore}>
                          {count.toLocaleString(language)}
                          <small>{leaderboardText.clicks}</small>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}

              {/* LIGNE PERSONNELLE SOUS LE TOP 10 */}

              {!leaderboardLoading &&
                !leaderboardError &&
                showViewerSeparately && (
                  <div className={styles.viewerSection}>
                    <p className={styles.viewerSectionLabel}>
                      {leaderboardText.yourRank}
                    </p>

                    <div
                      className={`${styles.leaderboardRow} ${styles.currentViewerRow}`}
                    >
                      <span className={styles.leaderboardRank}>
                        {viewerRank.toLocaleString(language)}
                      </span>

                      <span className={styles.leaderboardName}>
                        {leaderboardText.you}
                      </span>

                      <span className={styles.leaderboardScore}>
                        {Number(viewerEntry.clicks || 0).toLocaleString(
                          language,
                        )}

                        <small>{leaderboardText.clicks}</small>
                      </span>
                    </div>
                  </div>
                )}

              {/* Pays du visiteur si son pays est dans le top 10. */}

              {leaderboardTab === "daily" &&
                !viewer.daily &&
                !leaderboardLoading &&
                !leaderboardError && (
                  <p className={styles.viewerNotRanked}>
                    {leaderboardText.notRanked}
                  </p>
                )}

              <p className={styles.leaderboardFootnote}>
                {leaderboardText.refresh}
              </p>
            </div>
          </section>

          <div className={styles.messageArea}>
            <span className={styles.messageLabel}>{t.messageLabel}</span>

            <p
              className={styles.message}
              key={`${clicks}-${message}`}
              aria-live="polite"
            >
              {message}
            </p>
          </div>

          {globalError && (
            <p className={styles.error} role="status">
              {t.connectionError}
            </p>
          )}

          <button
            className={styles.shareButton}
            onClick={handleShare}
            disabled={!ready}
          >
            {copied ? t.copied : t.share}
            <span aria-hidden="true"></span>
          </button>
        </section>

        <footer className={styles.footer}>
          <span>{t.footerBrand}</span>
          <span>{t.footerText}</span>
        </footer>
      </main>

      {!introDone && (
        <div className={styles.introScreen} aria-hidden="true">
          <div className={styles.introGlow} />

          <p className={styles.introKicker}>{t.buttonHint}</p>

          <div className={styles.introTitle}>
            {t.logo}
            <span>.</span>
          </div>

          <div className={styles.introButton}>
            <span>{t.click}</span>
            <small>{t.forNothing}</small>
          </div>

          <p className={styles.introFooter}>{t.forNothing}</p>
        </div>
      )}
    </>
  );
}
