import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Inventory() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Inventory Management</h2>
          <p className="text-muted-foreground">
            Manage your vehicle listings and Facebook Marketplace posts
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Vehicle
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search vehicles..." className="pl-10" />
        </div>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Inventory Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Sample Vehicle Cards */}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="overflow-hidden">
            <div className="h-48 bg-muted"></div>
            <CardHeader>
              <CardTitle className="text-lg">2022 Honda Civic</CardTitle>
              <CardDescription>
                LX Sedan • 25,000 miles • VIN: 123456789
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <span className="text-2xl font-bold">$22,995</span>
                <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
                  Posted
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  Repost
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}