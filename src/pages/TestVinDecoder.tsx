import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function TestVinDecoder() {
  const [vin, setVin] = useState("");
  const [isDecoding, setIsDecoding] = useState(false);
  const [isBatchDecoding, setIsBatchDecoding] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSingleDecode = async () => {
    if (!vin || vin.length !== 17) {
      toast.error("Please enter a valid 17-character VIN");
      return;
    }

    setIsDecoding(true);
    try {
      const { data, error } = await supabase.functions.invoke('vin-decoder', {
        body: { vin }
      });

      if (error) throw error;

      setResult(data);
      toast.success("VIN decoded successfully!");
    } catch (error: any) {
      console.error('VIN decode error:', error);
      toast.error(error.message || "Failed to decode VIN");
    } finally {
      setIsDecoding(false);
    }
  };

  const handleBatchDecode = async () => {
    setIsBatchDecoding(true);
    try {
      const { data, error } = await supabase.functions.invoke('vin-decoder', {
        body: { 
          action: 'batch_decode',
          batch_size: 5
        }
      });

      if (error) throw error;

      setResult(data);
      toast.success(`Batch decode completed: ${data.message}`);
    } catch (error: any) {
      console.error('Batch decode error:', error);
      toast.error(error.message || "Failed to run batch decode");
    } finally {
      setIsBatchDecoding(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">VIN Decoder Test</h1>
        <p className="text-muted-foreground">
          Test the VIN decoding functionality and batch processing
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Single VIN Decode</CardTitle>
            <CardDescription>
              Test decoding a single VIN using the NHTSA API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="vin">VIN (17 characters)</Label>
              <Input
                id="vin"
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                placeholder="Enter VIN..."
                maxLength={17}
              />
            </div>
            <Button 
              onClick={handleSingleDecode}
              disabled={isDecoding || !vin || vin.length !== 17}
              className="w-full"
            >
              {isDecoding ? "Decoding..." : "Decode VIN"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Batch Decode</CardTitle>
            <CardDescription>
              Test the automated batch VIN decoding (same as cron job)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will find up to 5 vehicles with VINs that need decoding and process them.
            </p>
            <Button 
              onClick={handleBatchDecode}
              disabled={isBatchDecoding}
              className="w-full"
            >
              {isBatchDecoding ? "Processing..." : "Run Batch Decode"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={JSON.stringify(result, null, 2)}
              readOnly
              className="font-mono text-sm"
              rows={15}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}