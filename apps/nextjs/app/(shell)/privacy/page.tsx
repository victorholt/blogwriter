import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <div className="legal__content">
      <article className="legal__article">
        <h1>Privacy Policy</h1>
        <p className="legal__updated">Last updated: February 2026</p>

        <p>
          This Privacy Policy describes how we collect, use, and protect your information when you use
          our AI-powered blog generation platform (&ldquo;the Service&rdquo;). By using the Service, you
          agree to the collection and use of information in accordance with this policy.
        </p>

        <h2>Information We Collect</h2>

        <h3>Account Information</h3>
        <p>
          When you create an account, we collect your email address, display name, and a securely hashed
          password. This information is used solely to authenticate you and provide access to your workspace.
        </p>

        <h3>Usage Data</h3>
        <p>
          We collect information about how you interact with the Service, including the URLs you submit
          for brand voice analysis, the blog posts you generate, and the settings you configure. This data
          is stored in your workspace and is not shared with third parties.
        </p>

        <h3>Cookies</h3>
        <p>
          We use HTTP-only authentication cookies to maintain your session. These cookies contain encrypted
          tokens and are strictly necessary for the Service to function. We do not use tracking cookies or
          third-party analytics cookies.
        </p>

        <h2>How We Use Your Information</h2>
        <ul>
          <li>To provide and maintain the Service</li>
          <li>To authenticate your identity and manage your account</li>
          <li>To process your inputs through AI models for brand voice analysis and blog generation</li>
          <li>To store your generated content so you can access it later</li>
          <li>To improve the Service based on aggregate usage patterns</li>
        </ul>

        <h2>AI Processing</h2>
        <p>
          When you use the Service, your inputs (website URLs, brand voice data, dress selections, and
          instructions) are sent to third-party AI model providers for processing. These providers process
          data according to their own privacy policies and data handling agreements. We do not send your
          personal account information (email, password) to AI providers &mdash; only the content necessary
          for blog generation.
        </p>

        <h2>Data Retention</h2>
        <p>
          Your account data and generated content are retained as long as your account is active. If you
          request account deletion, all associated data will be permanently removed. Guest sessions
          (when guest mode is enabled) are ephemeral and not persisted after the session ends.
        </p>

        <h2>Data Security</h2>
        <p>
          We implement industry-standard security measures to protect your data, including encrypted
          passwords, HTTP-only cookies, and secure database storage. However, no method of transmission
          over the internet is 100% secure, and we cannot guarantee absolute security.
        </p>

        <h2>Data Sharing</h2>
        <p>
          We do not sell, trade, or rent your personal information to third parties. We may share data
          only when required by law or to protect the rights and safety of our users.
        </p>

        <h2>Your Rights</h2>
        <p>
          You have the right to access, correct, or delete your personal data at any time through your
          account settings or by contacting us. You may also request a copy of all data associated with
          your account.
        </p>

        <h2>Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Changes will be reflected on this page
          with an updated revision date.
        </p>
      </article>
    </div>
  );
}
