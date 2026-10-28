"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

const messages = [
  "Félicitations. Tu viens de perdre 0,4 seconde.",
  "Le monde te remercie pour ce clic inutile.",
  "Tu pensais que quelque chose allait se passer ?",
  "Ton clic a été archivé dans les dossiers du néant.",
  "Le bouton est fier de toi. Enfin, probablement.",
  "Une seconde de plus loin de tes objectifs.",
  "Tu es à deux clics d'une vie tout aussi inutile.",
  "Information importante : rien n'a changé.",
  "Un clic courageux. Une utilité inexistante.",
  "Merci pour cette contribution au vide.",
  "Quelqu'un devrait t'arrêter. Mais pas moi.",
  "Tu pourrais faire autre chose. Mais non.",
  "La productivité vient de quitter la pièce.",
  "Ton doigt mérite une pause. Toi aussi, peut-être.",
  "C'est officiellement un clic de plus.",
];

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
  } catch {
    // Le stockage peut être indisponible.
  }

  if (!window.crypto?.randomUUID) {
    throw new Error("Impossible de créer un identifiant anonyme.");
  }

  const id = window.crypto.randomUUID();

  try {
    window.localStorage.setItem(storageKey, id);
  } catch {
    // Le site reste utilisable, mais l'identifiant
    // ne sera pas conservé si le stockage est bloqué.
  }

  return id;
}

export default function Home() {
  const [clicks, setClicks] = useState(0);
  const [browserId, setBrowserId] = useState(null);
  const [message, setMessage] = useState(
    "Le bouton attend tes ordres. Malheureusement.",
  );
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [globalClicks, setGlobalClicks] = useState(null);
  const [globalError, setGlobalError] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
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

  async function handleClick() {
    if (!browserId || sending) {
      return;
    }

    setSending(true);

    const nextMessage = messages[Math.floor(Math.random() * messages.length)];

    setMessage(nextMessage);

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

      // Mise à jour après confirmation du serveur.
      setGlobalClicks(data.total);
      setGlobalError(false);

      // Le compteur personnel local n'augmente qu'après
      // la confirmation de l'enregistrement.
      setClicks((previous) => {
        const next = previous + 1;

        try {
          window.localStorage.setItem("useless-clicks", String(next));
        } catch {
          // Le compteur reste visible jusqu'au rechargement.
        }

        return next;
      });
    } catch (error) {
      console.error("Enregistrement du clic impossible:", error);
      setGlobalError(true);
      setMessage(
        error.message || "Le néant ne répond pas. Réessaie dans un instant.",
      );
    } finally {
      setSending(false);
    }
  }

  async function handleShare() {
    const text =
      `J'ai cliqué ${clicks} fois sur un bouton inutile. ` +
      "Peux-tu faire pire ?";

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Le Bouton Inutile",
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
        setMessage("Le partage a échoué. Même lui est inutile.");
      }
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.logo} href="/">
          LE BOUTON INUTILE<span>.</span>
        </a>
        <span className={styles.version}>VERSION 0.1</span>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>UNE ACTIVITÉ ABSOLUMENT INUTILE</p>

        <h1>
          Tu as mieux
          <br />à faire<span>.</span>
        </h1>

        <p className={styles.subtitle}>Et pourtant, te voilà.</p>

        <button
          className={styles.button}
          onClick={handleClick}
          disabled={!ready || !browserId || sending}
          aria-label="Cliquer sur le bouton inutile"
        >
          <span>{sending ? "..." : "CLIQUE"}</span>
          <small>POUR RIEN</small>
        </button>

        <p className={styles.counter}>
          {clicks.toLocaleString("fr-FR")} {clicks > 1 ? "clics" : "clic"}
        </p>

        <p
          className={styles.message}
          key={`${clicks}-${message}`}
          aria-live="polite"
        >
          {message}
        </p>

        <button
          className={styles.shareButton}
          onClick={handleShare}
          disabled={!ready}
        >
          {copied ? "Lien copié" : "Partager mon inutilité ↗"}
        </button>
      </section>

      <section className={styles.world}>
        <p className={styles.worldLabel}>CLIQUEURS DU NÉANT</p>

        <p className={styles.worldTitle}>
          {globalClicks === null
            ? "Comptage du vide..."
            : globalClicks.toLocaleString("fr-FR")}
        </p>

        <p className={styles.worldText}>
          {globalError
            ? "Connexion au néant interrompue. Réessaie dans un instant."
            : globalClicks === null
              ? "Le néant est en cours de calcul."
              : "Clics inutiles effectués par la communauté."}
        </p>
      </section>

      <footer className={styles.footer}>
        Aucune productivité n'a été améliorée pendant cette visite.
      </footer>
    </main>
  );
}
