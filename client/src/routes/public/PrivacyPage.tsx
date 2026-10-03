import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { PublicNav } from '@/components/layout/PublicNav'
import { CONTACT_EMAIL } from '@/lib/contact'

/**
 * Public privacy policy (YC-38), required by Google to publish the OAuth app. No frame in Figma: it wears
 * the public navigation and footer and the design tokens (YC-73), with the YC-38 text unchanged.
 * Every statement here is checked against the code and the hosting settings: when the app
 * changes what it stores or where, this page changes in the same pull request.
 */

const LAST_UPDATED = '30 septembre 2026'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-title-34 text-content">{title}</h2>
      <div className="mt-3 space-y-3 text-body-16 text-content-muted">{children}</div>
    </section>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-medium text-content underline underline-offset-2 hover:text-accent-text">
      {children}
    </a>
  )
}

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-page">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-8 sm:py-16">
        <Link to="/" className="text-small-13 font-medium text-content-muted underline-offset-2 hover:text-content hover:underline">
          ← Accueil
        </Link>
        <h1 className="mt-4 font-serif text-title-34 text-content sm:text-title-56">Confidentialité</h1>
        <p className="mt-2 font-mono text-mono-12 uppercase text-content-muted">Dernière mise à jour : {LAST_UPDATED}</p>
        <p className="mt-6 text-body-16 text-content-muted">
          Youcus est une application d’étude construite sur YouTube : tu importes tes playlists, tu les regardes sans
          distraction, tu prends des notes et tu suis ta progression. Cette page dit quelles données Youcus conserve,
          pourquoi, où, et comment les récupérer ou les effacer.
        </p>

        <Section title="Qui est responsable">
          <p>
            Youcus est édité par Ronaldo Rukundo, à titre personnel. Pour toute question sur tes données :{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-content underline underline-offset-2 hover:text-accent-text">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="Ce que Youcus conserve">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-content">Ton compte Google</strong> : ton adresse email, ton nom, l’adresse de ta
              photo de profil et l’identifiant de ton compte Google. Ils servent à te reconnaître quand tu te connectes.
              Youcus ne reçoit jamais ton mot de passe.
            </li>
            <li>
              <strong className="text-content">L’accès en lecture à YouTube</strong>, si tu connectes ton compte
              YouTube : un jeton qui permet à Youcus de lire la liste de tes playlists, y compris privées, pour les
              importer. Cet accès est en lecture seule : Youcus ne peut rien publier, modifier ni supprimer sur ton
              compte YouTube.
            </li>
            <li>
              <strong className="text-content">Ce que tu crées dans Youcus</strong> : les playlists importées, tes
              notes et ta progression de lecture.
            </li>
            <li>
              <strong className="text-content">Les informations publiques des vidéos</strong> : titres, descriptions,
              durées, chaînes, chapitres et compteurs, lus sur YouTube pour afficher tes playlists.
            </li>
          </ul>
          <p>
            Youcus ne vend aucune donnée, n’affiche aucune publicité et n’utilise aucun outil de mesure d’audience.
          </p>
        </Section>

        <Section title="Utilisation des données Google">
          <p>
            Youcus utilise les données reçues des API Google uniquement pour faire fonctionner les fonctions décrites
            ci-dessus, dans le respect de la{' '}
            <ExternalLink href="https://developers.google.com/terms/api-services-user-data-policy">
              Google API Services User Data Policy
            </ExternalLink>
            , y compris ses exigences d’utilisation limitée (Limited Use).
          </p>
        </Section>

        <Section title="Où sont les données">
          <p>
            Youcus est hébergé par Sevalla (Kinsta Inc.). L’application et sa base de données sont situées à Eemshaven,
            aux Pays-Bas, dans l’Union européenne. Les connexions passent par Cloudflare, qui protège le site.
          </p>
        </Section>

        <Section title="Cookies et stockage dans le navigateur">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <code className="text-content">youcus_session</code> : garde ta session ouverte, 7 jours. Indispensable.
            </li>
            <li>
              <code className="text-content">youcus_oauth_state</code> : protège la connexion Google contre la
              falsification, 10 minutes. Indispensable.
            </li>
            <li>
              Ton choix de thème clair ou sombre est gardé dans ton navigateur (stockage local), pas envoyé à Youcus.
            </li>
          </ul>
          <p>
            Le lecteur vidéo est celui de YouTube : quand tu regardes une vidéo, YouTube peut déposer ses propres
            cookies, selon les règles de confidentialité de Google.
          </p>
        </Section>

        <Section title="Journaux techniques">
          <p>
            Pour faire fonctionner et sécuriser le service, chaque requête est journalisée : adresse demandée, heure,
            code de réponse, navigateur et adresse réseau. Les cookies de session n’y figurent jamais.
          </p>
        </Section>

        <Section title="Tes droits">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-content">Récupérer tes données</strong> : Réglages, puis « Exporter mes données ».
              Tu reçois un fichier avec ton profil, tes playlists, tes notes et ta progression.
            </li>
            <li>
              <strong className="text-content">Tout effacer</strong> : Réglages, puis « Supprimer mon compte ». Ton
              compte, tes playlists, tes notes, ta progression et ton accès YouTube sont supprimés immédiatement.
            </li>
            <li>
              <strong className="text-content">Retirer l’accès de Youcus à ton compte Google</strong> : dans{' '}
              <ExternalLink href="https://myaccount.google.com/permissions">
                les autorisations de ton compte Google
              </ExternalLink>
              . Supprimer ton compte Youcus efface les jetons chez Youcus, mais l’autorisation reste listée chez Google
              tant que tu ne la retires pas.
            </li>
          </ul>
          <p>
            Tu peux aussi écrire à{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-content underline underline-offset-2 hover:text-accent-text">
              {CONTACT_EMAIL}
            </a>{' '}
            pour exercer tes autres droits (rectification, opposition, limitation), et saisir la{' '}
            <ExternalLink href="https://www.cnil.fr">CNIL</ExternalLink> si tu estimes que tes droits ne sont pas
            respectés.
          </p>
        </Section>
      </main>
      <PublicFooter />
    </div>
  )
}
