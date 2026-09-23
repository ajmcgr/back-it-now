import { createFileRoute } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  head: () =>
    publicSeo({
      title: "Contact | Backed",
      description: "Contact Backed with questions about projects, partnerships or press.",
      path: "/contact",
    }),
  component: ContactPage,
});

function ContactPage() {
  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "");
    const subject = String(form.get("subject") ?? "Question about Backed");
    const message = String(form.get("message") ?? "");
    const body = [`Name: ${name}`, `Email: ${email}`, "", message].join("\n");

    window.location.href = `mailto:hello@backedit.co?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <main className="container-backed py-16 sm:py-24">
      <div className="max-w-3xl">
        <h1 className="text-5xl font-semibold sm:text-6xl">Contact</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Questions, partnerships or press? Get in touch.
        </p>

        <section className="mt-12" aria-labelledby="send-message-heading">
          <h2 id="send-message-heading" className="text-2xl font-semibold">
            Send a message
          </h2>
          <form onSubmit={sendMessage} className="mt-6 space-y-5">
            <ContactField label="Name" name="name" type="text" required />
            <ContactField label="Email" name="email" type="email" required />
            <ContactField label="Subject (optional)" name="subject" type="text" />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Message</span>
              <Textarea name="message" required className="min-h-40" />
            </label>
            <Button type="submit">Send message</Button>
            <p className="text-sm text-muted-foreground">
              This opens your email app and sends to hello@backedit.co.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

function ContactField({
  label,
  name,
  type,
  required = false,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <Input name={name} type={type} required={required} className="h-11" />
    </label>
  );
}
