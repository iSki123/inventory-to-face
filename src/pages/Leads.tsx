import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, MessageSquare, Phone, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Leads() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Lead Management</h2>
        <p className="text-muted-foreground">
          Manage customer inquiries and follow-ups
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." className="pl-10" />
        </div>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Leads List */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">John Smith</CardTitle>
                  <CardDescription>
                    Interested in 2022 Honda Civic • 2 hours ago
                  </CardDescription>
                </div>
                <Badge variant={i <= 2 ? "default" : i <= 4 ? "secondary" : "outline"}>
                  {i <= 2 ? "New" : i <= 4 ? "Responded" : "Follow-up"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    "Hi, I'm interested in the Honda Civic you have listed. Is it still available? Can you tell me more about the maintenance history?"
                  </p>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    (555) 123-4567
                  </div>
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    john.smith@email.com
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Reply
                  </Button>
                  <Button variant="outline" size="sm">
                    AI Reply
                  </Button>
                  <Button variant="outline" size="sm">
                    Call
                  </Button>
                  <Button variant="outline" size="sm">
                    Mark as Sold
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}