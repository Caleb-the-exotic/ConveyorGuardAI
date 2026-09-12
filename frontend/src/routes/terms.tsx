import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsOfService,
});

function TermsOfService() {
  return (
    <div className="mx-auto max-w-4xl p-6 md:p-12 text-foreground/90">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Terms of Service</h1>
      
      <p className="mb-4">
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-info mt-8">1. Acceptance of Terms</h2>
        <p>
          By accessing and using ConveyorGuard AI, you accept and agree to be bound by the terms and provision of this agreement.
        </p>

        <h2 className="text-xl font-semibold text-info mt-8">2. Description of Service</h2>
        <p>
          ConveyorGuard AI provides real-time conveyor belt health monitoring, predictive maintenance analytics, and AI-powered diagnostic tools. We integrate with your existing sensor hardware and computer vision cameras to provide actionable insights.
        </p>

        <h2 className="text-xl font-semibold text-info mt-8">3. User Accounts</h2>
        <p>
          To access certain features of the service, you may be required to authenticate using Google OAuth. You are responsible for maintaining the confidentiality of your account information.
        </p>

        <h2 className="text-xl font-semibold text-info mt-8">4. Acceptable Use</h2>
        <p>
          You agree to not use the service for any unlawful purpose or in any way that could interrupt, damage, or impair the service.
        </p>

        <h2 className="text-xl font-semibold text-info mt-8">5. Disclaimer of Warranties</h2>
        <p>
          The service is provided "as is". While we strive for accuracy in our AI predictive maintenance models, we make no warranties, expressed or implied, regarding the absolute accuracy or reliability of the diagnostic reports. Always verify critical safety alerts with on-site engineering personnel.
        </p>

        <h2 className="text-xl font-semibold text-info mt-8">6. Changes to Terms</h2>
        <p>
          We reserve the right to modify these terms at any time. Your continued use of the service following any changes indicates your acceptance of the new terms.
        </p>
      </section>
    </div>
  );
}
