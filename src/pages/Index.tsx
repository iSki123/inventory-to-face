import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, Users, MessageSquare, TrendingUp, ArrowRight, Zap, Shield, CreditCard, Clock } from 'lucide-react';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
// @ts-ignore - Vanta doesn't have TypeScript definitions
import NET from 'vanta/dist/vanta.net.min';
const Index = () => {
  const { user, loading } = useAuth();
  const vantaRef = useRef<HTMLDivElement>(null);
  const vantaEffect = useRef<any>(null);

  // Vanta NET effect
  useEffect(() => {
    if (!vantaRef.current) return;

    vantaEffect.current = NET({
      el: vantaRef.current,
      THREE: THREE,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200.00,
      minWidth: 200.00,
      scale: 0.5, // Reduced scale to make animation smaller
      scaleMobile: 0.3, // Even smaller on mobile
      color: '#ffffff', // White color for the network lines
      backgroundColor: '#000000', // Black background
      points: 4.00, // Reduced from 6 to make it even less busy
      maxDistance: 10.00, // Reduced from 15 to make connections shorter
      spacing: 25.00, // Increased from 20 to spread out points more
      backgroundAlpha: 0.3 // Make background more transparent
    });

    return () => {
      if (vantaEffect.current) {
        vantaEffect.current.destroy();
      }
    };
  }, []);

  // SEO: dynamic title, description and canonical
  useEffect(() => {
    const title = 'Salesonator | Pay‑As‑You‑Go Facebook Marketplace Automation';
    const description = 'Pay‑as‑you‑go solution for dealership owners, managers, and salespeople to sell more cars with Facebook automation, AI replies, and a unified lead inbox.';
    document.title = title;

    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = description;

    const canonicalHref = `${window.location.origin}/`;
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalHref;
  }, []);

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://salesonator.com';
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How does pricing work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Salesonator uses a credit-based, pay-as-you-go model. Purchase credits and use them for listings and AI-powered replies—only pay for what you use.'
        }
      },
      {
        '@type': 'Question',
        name: 'Do I need to change my current workflow?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. Connect your website inventory, post to Facebook Marketplace automatically, and manage all conversations from one inbox.'
        }
      },
      {
        '@type': 'Question',
        name: 'What do I need to get started?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Create an account, connect your inventory source, and start posting. No long-term contracts—start with a small credit pack.'
        }
      }
    ]
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If user is authenticated, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div ref={vantaRef} className="min-h-screen relative text-white">
      <style>
        {`
          .white-text h1, .white-text h2, .white-text h3, .white-text p, .white-text span {
            color: white !important;
          }
          .white-text .text-muted-foreground {
            color: rgba(255, 255, 255, 0.7) !important;
          }
          .white-text .text-primary {
            color: white !important;
          }
          .black-header .text-primary {
            color: black !important;
          }
          .black-button {
            background-color: black !important;
            color: white !important;
            border-color: black !important;
          }
          .black-button:hover {
            background-color: #333 !important;
            color: white !important;
          }
          .black-text * {
            color: black !important;
          }
          .black-text .text-muted-foreground {
            color: #666 !important;
          }
        `}
      </style>
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 black-header">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-2">
            <Car className="h-8 w-8 text-black" />
            <span className="text-2xl font-bold text-black">Salesonator</span>
          </div>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" asChild className="text-black hover:text-black">
              <Link to="#features">Features</Link>
            </Button>
            <Button variant="ghost" asChild className="text-black hover:text-black">
              <Link to="#how-it-works">How it works</Link>
            </Button>
            <Button variant="ghost" asChild className="text-black hover:text-black">
              <Link to="#faq">FAQ</Link>
            </Button>
            <Button asChild className="black-button">
              <Link to="/auth">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-20 px-4 white-text">
          <div className="container max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
                Pay‑As‑You‑Go Facebook Marketplace Automation
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Built for dealership owners, managers, and salespeople: post vehicles, handle leads, and send AI‑powered replies—all from one dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild className="black-button">
                  <Link to="/auth">Start Free</Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="text-white border-white hover:bg-white hover:text-black">
                  <a href="#how-it-works">See how it works</a>
                </Button>
              </div>

              {/* Proof strip */}
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-6 text-left">
                <div>
                  <div className="flex items-center gap-2 font-semibold"><Zap className="h-5 w-5 text-white" /> Faster Listings</div>
                  <p className="text-muted-foreground text-sm">Automated posting to Marketplace</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 font-semibold"><MessageSquare className="h-5 w-5 text-white" /> AI Replies</div>
                  <p className="text-muted-foreground text-sm">Human‑like responses, instantly</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 font-semibold"><CreditCard className="h-5 w-5 text-white" /> Pay‑As‑You‑Go</div>
                  <p className="text-muted-foreground text-sm">Only pay for the credits you use</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm text-foreground">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <TrendingUp className="h-10 w-10 text-primary mb-2" />
                    <CardTitle className="text-xl">Boost Efficiency</CardTitle>
                    <CardDescription>Automate repetitive steps and save hours weekly.</CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <Shield className="h-10 w-10 text-primary mb-2" />
                    <CardTitle className="text-xl">Human‑like Automation</CardTitle>
                    <CardDescription>Engineered to mimic real behavior to reduce flags.</CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <Users className="h-10 w-10 text-primary mb-2" />
                    <CardTitle className="text-xl">Lead Inbox</CardTitle>
                    <CardDescription>Track conversations and statuses in one place.</CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <Clock className="h-10 w-10 text-primary mb-2" />
                    <CardTitle className="text-xl">Real‑time Updates</CardTitle>
                    <CardDescription>Refresh leads, retry posts, and monitor activity.</CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-20 px-4 bg-muted/50">
          <div className="container max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">How It Works</h2>
              <p className="text-lg text-muted-foreground">From inventory to conversations in four simple steps</p>
            </div>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { step: 1, title: 'Connect Inventory', desc: 'Pull vehicles via our scraper integration.' },
                { step: 2, title: 'Post to Marketplace', desc: 'Human‑like automation publishes your listings.' },
                { step: 3, title: 'Engage Leads', desc: 'AI crafts replies; track every conversation.' },
                { step: 4, title: 'Pay As You Go', desc: 'Use credits only when you post or reply.' },
              ].map((s) => (
                <div key={s.step} className="rounded-lg border bg-card p-6">
                  <div className="text-primary text-sm font-semibold mb-1">Step {s.step}</div>
                  <h3 className="text-xl font-semibold mb-2">{s.title}</h3>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 px-4">
          <div className="container max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">Everything You Need</h2>
              <p className="text-lg text-muted-foreground">Use the tools we built to scale your dealership operations</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { Icon: Car, title: 'Inventory Management', desc: 'Scrape and sync vehicles with images, VIN, and details.' },
                { Icon: MessageSquare, title: 'AI Lead Responses', desc: 'Personalized, human‑like replies with simulated typing.' },
                { Icon: TrendingUp, title: 'Analytics', desc: 'Track posting success, conversion, and response times.' },
                { Icon: Users, title: 'Lead Inbox', desc: 'Statuses, search, export, and real‑time refresh.' },
                { Icon: Shield, title: 'Human‑Behavior Automation', desc: 'Reduce detection risk with thoughtful pacing.' },
                { Icon: CreditCard, title: 'Credits‑Based Billing', desc: 'Flexible, scalable pricing—no contracts.' },
              ].map(({ Icon, title, desc }) => (
                <Card key={title} className="hover-scale">
                  <CardHeader>
                    <Icon className="h-12 w-12 text-primary mb-4" />
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing CTA */}
        <section className="py-20 px-4 bg-muted/50">
          <div className="container max-w-5xl mx-auto">
            <div className="rounded-xl border bg-card p-8 md:p-12 text-center shadow-sm">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Only Pay For What You Use</h2>
              <p className="text-lg text-muted-foreground mb-8">Purchase credits for postings and AI replies. Scale up when you need to—no subscriptions required.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild className="black-button">
                  <Link to="/billing">View Credit Options</Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="border-black text-black hover:bg-black hover:text-white">
                  <Link to="/auth">Create a Free Account</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials (Sample placeholders) */}
        <section className="py-20 px-4">
          <div className="container max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">What Dealers Say</h2>
              <p className="text-sm text-muted-foreground">Sample reviews for layout—replace with real customer feedback when available.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                'Posted 30 cars in an afternoon and closed 3 deals the same week.',
                'Our team replies faster with AI suggestions—conversations feel natural.',
                'Credits keep costs predictable. We pay more only when we sell more.'
              ].map((quote, i) => (
                <Card key={i}>
                  <CardHeader>
                    <CardTitle className="text-xl">Sample Review</CardTitle>
                    <CardDescription>“{quote}”</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 px-4 bg-muted/50">
          <div className="container max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">Frequently Asked Questions</h2>
              <p className="text-lg text-muted-foreground">Quick answers about pricing, setup, and workflow</p>
            </div>
            <div className="space-y-4">
              <details className="rounded-lg border bg-card p-4" open>
                <summary className="cursor-pointer font-semibold">How does pricing work?</summary>
                <p className="mt-2 text-muted-foreground">Salesonator uses credits. Use them for postings and AI replies. Buy more anytime.</p>
              </details>
              <details className="rounded-lg border bg-card p-4">
                <summary className="cursor-pointer font-semibold">Do I need a long‑term contract?</summary>
                <p className="mt-2 text-muted-foreground">No. Start small and scale up as needed—pay only for what you use.</p>
              </details>
              <details className="rounded-lg border bg-card p-4">
                <summary className="cursor-pointer font-semibold">Can my whole team use it?</summary>
                <p className="mt-2 text-muted-foreground">Yes. Owners, managers, and salespeople can collaborate using the shared lead inbox.</p>
              </details>
            </div>
          </div>
          {/* Structured data for FAQ */}
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        </section>

        {/* Final CTA */}
        <section className="py-20 px-4">
          <div className="container max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Sell More Cars?</h2>
            <p className="text-xl text-muted-foreground mb-8">Start posting to Facebook Marketplace and engaging leads today.</p>
            <Button size="lg" asChild className="black-button">
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container text-center text-muted-foreground">
          <p>&copy; 2025 Salesonator. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
