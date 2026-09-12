import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-4xl p-6 md:p-12 text-foreground/90">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Privacy Policy</h1>
      
      <p className="mb-4">
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-info mt-8">1. Introduction</h2>
        <p>
          Welcome to ConveyorGuard AI. We respect your privacy and are committed to protecting your personal data. 
          This privacy policy will inform you about how we look after your personal data when you visit our 
          application and tell you about your privacy rights and how the law protects you.
        </p>

        <h2 className="text-xl font-semibold text-info mt-8">2. The Data We Collect About You</h2>
        <p>
          We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Identity Data</strong> includes first name, last name, username or similar identifier, provided via Google OAuth.</li>
          <li><strong>Contact Data</strong> includes email address, provided via Google OAuth.</li>
          <li><strong>Technical Data</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location.</li>
        </ul>

        <h2 className="text-xl font-semibold text-info mt-8">3. How We Use Your Data</h2>
        <p>
          We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>To authenticate you securely using Google OAuth to access the dashboard.</li>
          <li>To send you Critical Alerts, Diagnostics Reports, and Work Orders via email as requested by the application.</li>
        </ul>

        <h2 className="text-xl font-semibold text-info mt-8">4. Data Security</h2>
        <p>
          We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed.
        </p>

        <h2 className="text-xl font-semibold text-info mt-8">5. Google API Services User Data Policy</h2>
        <p>
          ConveyorGuard AI's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-info underline hover:text-info/80" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.
        </p>

        <h2 className="text-xl font-semibold text-info mt-8">6. Contact Us</h2>
        <p>
          If you have any questions about this privacy policy or our privacy practices, please contact the repository maintainers via GitHub.
        </p>
      </section>
    </div>
  );
}
