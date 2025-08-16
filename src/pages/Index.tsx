import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, Users, MessageSquare, TrendingUp, Zap, Shield, CreditCard, Clock } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import * as THREE from 'three';
// @ts-ignore - Vanta doesn't have TypeScript definitions
import NET from 'vanta/dist/vanta.net.min';

const Index = () => {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();
  const vantaRef = useRef<HTMLDivElement>(null);
  const vantaEffect = useRef<any>(null);

  // Vanta NET effect for hero section only - skip on mobile to prevent crashes
  useEffect(() => {
    if (!vantaRef.current || isMobile) return;

    try {
      vantaEffect.current = NET({
        el: vantaRef.current,
        THREE: THREE,
        mouseControls: true,
        touchControls: false, // Disable on desktop to avoid conflicts
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
        scale: 0.25,
        color: 0x4d99d9,
        backgroundColor: 0x0,
        points: 8.00,
        maxDistance: 18.00,
        spacing: 16.00
      });
    } catch (error) {
      console.error('Vanta initialization failed:', error);
    }

    return () => {
      if (vantaEffect.current) {
        try {
          vantaEffect.current.destroy();
        } catch (error) {
          console.error('Vanta cleanup failed:', error);
        }
      }
    };
  }, [isMobile]);

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If user is authenticated, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-2">
            <Car className="h-8 w-8 text-foreground" />
            <span className="text-2xl font-bold text-foreground">Salesonator</span>
          </div>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="#features">Features</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="#how-it-works">How it works</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="#faq">FAQ</Link>
            </Button>
            <Button asChild className="bg-foreground text-background hover:bg-foreground/90">
              <Link to="/auth">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="pt-16">
        {/* Hero Section with Vanta Background */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
          {/* Vanta Background Container - only on desktop */}
          {!isMobile && <div ref={vantaRef} className="absolute inset-0 z-0"></div>}
          {/* Mobile gradient background */}
          {isMobile && <div className="absolute inset-0 bg-black z-0"></div>}
          {/* Content overlay with minimal interference */}
          <div className="absolute inset-0 bg-black/10 z-10"></div>
          <div className="container relative z-20 grid lg:grid-cols-2 gap-10 items-center min-h-screen py-20">
            
            {/* Hero Content */}
            <div className="text-center lg:text-left text-white">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
                Pay‑As‑You‑Go
                <br />
                <span className="text-blue-400">Facebook</span>
                <br />
                Marketplace
                <br />
                Automation
              </h1>
              <p className="text-xl md:text-2xl mb-8 text-gray-200 max-w-2xl">
                Built for dealership owners, managers, and salespeople: post vehicles, handle leads, and send AI‑powered replies—all from one dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
                <Button size="lg" asChild className="bg-white text-black hover:bg-gray-100 text-lg px-8 py-6">
                  <Link to="/auth">Start Free</Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="border-white text-black hover:bg-[#65a6f7] hover:text-white hover:border-[#65a6f7] text-lg px-8 py-6">
                  <a href="#how-it-works">See how it works</a>
                </Button>
              </div>

              {/* Feature Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto lg:mx-0">
                <div className="flex items-center gap-2 text-sm bg-white/10 backdrop-blur rounded-full px-4 py-2">
                  <Zap className="h-4 w-4" style={{ color: '#669bde' }} />
                  <span>Faster Listings</span>
                </div>
                <div className="flex items-center gap-2 text-sm bg-white/10 backdrop-blur rounded-full px-4 py-2">
                  <MessageSquare className="h-4 w-4" style={{ color: '#669bde' }} />
                  <span>AI Replies</span>
                </div>
                <div className="flex items-center gap-2 text-sm bg-white/10 backdrop-blur rounded-full px-4 py-2">
                  <CreditCard className="h-4 w-4" style={{ color: '#669bde' }} />
                  <span>Pay‑As‑You‑Go</span>
                </div>
              </div>
            </div>

            {/* Hero Cards */}
            <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
              <Card className="bg-white/95 backdrop-blur border-0 shadow-xl">
                <CardHeader className="pb-3">
                  <TrendingUp className="h-10 w-10 mb-2" style={{ color: '#669bde' }} />
                  <CardTitle className="text-lg">Boost Efficiency</CardTitle>
                  <CardDescription className="text-sm">
                    Automate repetitive steps and save hours weekly.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="bg-white/95 backdrop-blur border-0 shadow-xl">
                <CardHeader className="pb-3">
                  <Shield className="h-10 w-10 mb-2" style={{ color: '#669bde' }} />
                  <CardTitle className="text-lg">Human‑like Automation</CardTitle>
                  <CardDescription className="text-sm">
                    Engineered to mimic real behavior to reduce flags.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="bg-white/95 backdrop-blur border-0 shadow-xl">
                <CardHeader className="pb-3">
                  <Users className="h-10 w-10 mb-2" style={{ color: '#669bde' }} />
                  <CardTitle className="text-lg">Lead Inbox</CardTitle>
                  <CardDescription className="text-sm">
                    Track conversations and statuses in one place.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="bg-white/95 backdrop-blur border-0 shadow-xl">
                <CardHeader className="pb-3">
                  <Clock className="h-10 w-10 mb-2" style={{ color: '#669bde' }} />
                  <CardTitle className="text-lg">Real‑time Updates</CardTitle>
                  <CardDescription className="text-sm">
                    Refresh leads, retry posts, and monitor activity.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-20 px-4 bg-gray-50">
          <div className="container max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">How It Works</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">From inventory to conversations in four simple steps</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { step: 1, title: 'Connect Inventory', desc: 'Pull vehicles via our scraper integration.', icon: Car },
                { step: 2, title: 'Post to Marketplace', desc: 'Human‑like automation publishes your listings.', icon: Zap },
                { step: 3, title: 'Engage Leads', desc: 'AI crafts replies; track every conversation.', icon: MessageSquare },
                { step: 4, title: 'Pay As You Go', desc: 'Use credits only when you post or reply.', icon: CreditCard },
              ].map((s) => (
                <Card key={s.step} className="relative border-0 shadow-lg bg-white hover:shadow-xl transition-shadow">
                  <CardHeader className="text-center pb-6">
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-8 h-8 text-white rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: '#669bde' }}>
                      {s.step}
                    </div>
                    <s.icon className="h-12 w-12 mb-4 mx-auto mt-4" style={{ color: '#669bde' }} />
                    <CardTitle className="text-xl text-foreground">{s.title}</CardTitle>
                    <CardDescription className="text-muted-foreground">{s.desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 px-4 bg-white">
          <div className="container max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">Everything You Need</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Use the tools we built to scale your dealership operations</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { Icon: Car, title: 'Inventory Management', desc: 'Scrape and sync vehicles with images, VIN, and details.' },
                { Icon: MessageSquare, title: 'AI Lead Responses', desc: 'Personalized, human‑like replies with simulated typing.' },
                { Icon: TrendingUp, title: 'Analytics', desc: 'Track posting success, conversion, and response times.' },
                { Icon: Users, title: 'Lead Inbox', desc: 'Statuses, search, export, and real‑time refresh.' },
                { Icon: Shield, title: 'Human‑Behavior Automation', desc: 'Reduce detection risk with thoughtful pacing.' },
                { Icon: CreditCard, title: 'Credits‑Based Billing', desc: 'Flexible, scalable pricing—no contracts.' },
              ].map(({ Icon, title, desc }) => (
                <Card key={title} className="border-0 shadow-lg bg-white hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <CardHeader className="text-center">
                    <Icon className="h-16 w-16 mb-4 mx-auto" style={{ color: '#669bde' }} />
                    <CardTitle className="text-xl text-foreground mb-2">{title}</CardTitle>
                    <CardDescription className="text-muted-foreground">{desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing CTA */}
        <section className="py-20 px-4 bg-gradient-to-r from-[#4a84cb] to-blue-800 text-white">
          <div className="container max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Only Pay For What You Use</h2>
            <p className="text-xl mb-10 text-blue-100 max-w-2xl mx-auto">Purchase credits for postings and AI replies. Scale up when you need to—no subscriptions required.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild className="bg-white text-black hover:bg-gray-100 text-lg px-8 py-6">
                <Link to="/billing">View Credit Options</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-white text-black hover:bg-gray-100 hover:text-black text-lg px-8 py-6">
                <Link to="/auth">Create a Free Account</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="container max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">What Dealers Say</h2>
              <p className="text-lg text-muted-foreground">Sample reviews for layout—replace with real customer feedback when available.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                'Posted 30 cars in an afternoon and closed 3 deals the same week.',
                'Our team replies faster with AI suggestions—conversations feel natural.',
                'Credits keep costs predictable. We pay more only when we sell more.'
              ].map((quote, i) => (
                <Card key={i} className="border-0 shadow-lg bg-white">
                  <CardHeader>
                    <CardTitle className="text-lg text-foreground">Sample Review</CardTitle>
                    <CardDescription className="text-muted-foreground italic">"{quote}"</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 px-4 bg-white">
          <div className="container max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">Frequently Asked Questions</h2>
              <p className="text-xl text-muted-foreground">Quick answers about pricing, setup, and workflow</p>
            </div>
            <div className="space-y-6">
              <Card className="border shadow-lg">
                <CardHeader>
                  <details open>
                    <summary className="cursor-pointer font-semibold text-lg text-foreground hover:text-blue-600">How does pricing work?</summary>
                    <p className="mt-4 text-muted-foreground">Salesonator uses credits. Use them for postings and AI replies. Buy more anytime.</p>
                  </details>
                </CardHeader>
              </Card>
              <Card className="border shadow-lg">
                <CardHeader>
                  <details>
                    <summary className="cursor-pointer font-semibold text-lg text-foreground hover:text-blue-600">Do I need a long‑term contract?</summary>
                    <p className="mt-4 text-muted-foreground">No. Start small and scale up as needed—pay only for what you use.</p>
                  </details>
                </CardHeader>
              </Card>
              <Card className="border shadow-lg">
                <CardHeader>
                  <details>
                    <summary className="cursor-pointer font-semibold text-lg text-foreground hover:text-blue-600">Can my whole team use it?</summary>
                    <p className="mt-4 text-muted-foreground">Yes. Owners, managers, and salespeople can collaborate using the shared lead inbox.</p>
                  </details>
                </CardHeader>
              </Card>
            </div>
          </div>
          {/* Structured data for FAQ */}
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        </section>

        {/* Final CTA */}
        <section className="py-20 px-4 bg-foreground text-background">
          <div className="container max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to Sell More Cars?</h2>
            <p className="text-xl mb-10 opacity-80 max-w-2xl mx-auto">Start posting to Facebook Marketplace and engaging leads today.</p>
            <Button size="lg" asChild className="bg-background text-foreground hover:bg-background/90 text-lg px-8 py-6">
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 px-4 bg-background">
        <div className="container text-center">
          <p className="text-muted-foreground">&copy; 2025 Salesonator. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;