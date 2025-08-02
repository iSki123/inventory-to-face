import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Download, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Billing() {
  const { profile } = useAuth();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Billing & Credits</h2>
        <p className="text-muted-foreground">
          Manage your credits and billing information
        </p>
      </div>

      {/* Credit Balance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Credit Balance
          </CardTitle>
          <CardDescription>
            Credits are used for posting vehicles and AI-generated responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">{profile?.credits || 0}</div>
              <p className="text-sm text-muted-foreground">Available credits</p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Purchase Credits
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Credit Packages */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Credit Packages</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Starter</CardTitle>
              <CardDescription>Perfect for small dealerships</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">$29</div>
              <p className="text-sm text-muted-foreground mb-4">100 credits</p>
              <ul className="text-sm space-y-1 mb-4">
                <li>• 50 vehicle posts</li>
                <li>• 100 AI responses</li>
                <li>• Basic support</li>
              </ul>
              <Button className="w-full">Select Plan</Button>
            </CardContent>
          </Card>

          <Card className="border-primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Professional</CardTitle>
                  <CardDescription>Most popular choice</CardDescription>
                </div>
                <Badge>Popular</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">$79</div>
              <p className="text-sm text-muted-foreground mb-4">300 credits</p>
              <ul className="text-sm space-y-1 mb-4">
                <li>• 150 vehicle posts</li>
                <li>• 300 AI responses</li>
                <li>• Priority support</li>
                <li>• Analytics dashboard</li>
              </ul>
              <Button className="w-full">Select Plan</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enterprise</CardTitle>
              <CardDescription>For large dealerships</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">$199</div>
              <p className="text-sm text-muted-foreground mb-4">1000 credits</p>
              <ul className="text-sm space-y-1 mb-4">
                <li>• 500 vehicle posts</li>
                <li>• 1000 AI responses</li>
                <li>• 24/7 support</li>
                <li>• Custom integrations</li>
              </ul>
              <Button className="w-full">Select Plan</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Usage History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usage History</CardTitle>
              <CardDescription>Recent credit transactions</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { type: "Vehicle Post", credits: -2, date: "2 hours ago" },
              { type: "AI Response", credits: -1, date: "4 hours ago" },
              { type: "Credit Purchase", credits: +100, date: "Yesterday" },
              { type: "Vehicle Post", credits: -2, date: "Yesterday" },
            ].map((transaction, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div>
                  <p className="font-medium">{transaction.type}</p>
                  <p className="text-sm text-muted-foreground">{transaction.date}</p>
                </div>
                <span className={`font-medium ${transaction.credits > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {transaction.credits > 0 ? '+' : ''}{transaction.credits} credits
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}