import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Database, Car, Zap, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export default function AdminPanel() {
  const [isForceDecoding, setIsForceDecoding] = useState(false);
  const [isBatchDecoding, setIsBatchDecoding] = useState(false);
  const [singleVin, setSingleVin] = useState("");
  const [isDecodingSingle, setIsDecodingSingle] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Get VIN statistics
  const { data: vinStats, refetch: refetchStats } = useQuery({
    queryKey: ['vin-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, vin, vin_decoded_at')
        .not('vin', 'is', null);
      
      if (error) throw error;
      
      const totalWithVin = data.length;
      const decoded = data.filter(v => v.vin_decoded_at).length;
      const needsDecoding = totalWithVin - decoded;
      const lastDecoded = data
        .filter(v => v.vin_decoded_at)
        .sort((a, b) => new Date(b.vin_decoded_at).getTime() - new Date(a.vin_decoded_at).getTime())[0];

      return {
        totalWithVin,
        decoded,
        needsDecoding,
        lastDecoded: lastDecoded?.vin_decoded_at || null
      };
    }
  });

  const handleForceMassDecoding = async () => {
    setIsForceDecoding(true);
    try {
      // Instead of clearing all data first, let's just trigger decoding with force flag
      // This will re-decode all VINs without losing the current data during the process
      
      // Get all vehicles with VINs for batch processing
      const { data: allVehicles, error: fetchError } = await supabase
        .from('vehicles')
        .select('id, vin')
        .not('vin', 'is', null);

      if (fetchError) throw fetchError;

      // Process in batches to avoid overwhelming the system
      const batchSize = 20;
      let totalProcessed = 0;
      
      for (let i = 0; i < (allVehicles?.length || 0); i += batchSize) {
        const batch = allVehicles?.slice(i, i + batchSize) || [];
        
        // Clear vin_decoded_at only for current batch to force re-decoding
        const vehicleIds = batch.map(v => v.id);
        await supabase
          .from('vehicles')
          .update({ vin_decoded_at: null })
          .in('id', vehicleIds);

        // Then trigger batch decoding for this batch
        const { data, error } = await supabase.functions.invoke('vin-decoder', {
          body: {
            action: 'batch_decode',
            batch_size: batchSize
          }
        });

        if (error) throw error;
        
        totalProcessed += batch.length;
        console.log(`Processed batch ${Math.floor(i/batchSize) + 1}, total processed: ${totalProcessed}`);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast.success(`Force decode completed: ${totalProcessed} vehicles processed in batches`);
      refetchStats();
    } catch (error: any) {
      console.error('Force decode error:', error);
      toast.error(error.message || "Failed to force mass decoding");
    } finally {
      setIsForceDecoding(false);
    }
  };

  const handleBatchDecode = async () => {
    setIsBatchDecoding(true);
    try {
      const { data, error } = await supabase.functions.invoke('vin-decoder', {
        body: {
          action: 'batch_decode',
          batch_size: 10
        }
      });

      if (error) throw error;

      setResult(data);
      toast.success(`Batch decode completed: ${data.message}`);
      refetchStats();
    } catch (error: any) {
      console.error('Batch decode error:', error);
      toast.error(error.message || "Failed to run batch decode");
    } finally {
      setIsBatchDecoding(false);
    }
  };

  const handleSingleVinDecode = async () => {
    if (!singleVin || singleVin.length !== 17) {
      toast.error("Please enter a valid 17-character VIN");
      return;
    }

    setIsDecodingSingle(true);
    try {
      const { data, error } = await supabase.functions.invoke('vin-decoder', {
        body: { vin: singleVin }
      });

      if (error) throw error;

      setResult(data);
      toast.success("VIN decoded successfully!");
      refetchStats();
    } catch (error: any) {
      console.error('Single VIN decode error:', error);
      toast.error(error.message || "Failed to decode VIN");
    } finally {
      setIsDecodingSingle(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Admin Panel - VIN Management</h1>
        <p className="text-muted-foreground">
          Monitor and control VIN decoding operations
        </p>
      </div>

      {/* VIN Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            VIN Decoding Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold">{vinStats?.totalWithVin || 0}</div>
              <div className="text-sm text-muted-foreground">Total Vehicles with VIN</div>
            </div>
            <div className="text-center p-4 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{vinStats?.decoded || 0}</div>
              <div className="text-sm text-muted-foreground">Decoded VINs</div>
            </div>
            <div className="text-center p-4 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{vinStats?.needsDecoding || 0}</div>
              <div className="text-sm text-muted-foreground">Need Decoding</div>
            </div>
            <div className="text-center p-4 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm font-medium">Last Decoded</div>
              <div className="text-xs text-muted-foreground">
                {vinStats?.lastDecoded 
                  ? new Date(vinStats.lastDecoded).toLocaleString()
                  : 'Never'
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* VIN Decoding Controls */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Force Mass Decoding
            </CardTitle>
            <CardDescription>
              Clear all VIN decode timestamps and re-decode all vehicles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive">⚠️ Warning</p>
              <p className="text-xs text-muted-foreground mt-1">
                This will force re-decode all VINs, even ones already decoded. Use with caution.
              </p>
            </div>
            <Button 
              onClick={handleForceMassDecoding}
              disabled={isForceDecoding}
              variant="destructive"
              className="w-full"
            >
              {isForceDecoding ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Force Decoding...
                </>
              ) : (
                'Force Mass Decode'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Regular Batch Decode
            </CardTitle>
            <CardDescription>
              Run the same process as the automated cron job
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will decode up to 10 vehicles with VINs that need decoding.
            </p>
            <Button 
              onClick={handleBatchDecode}
              disabled={isBatchDecoding}
              className="w-full"
            >
              {isBatchDecoding ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Run Batch Decode'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Single VIN Decode
            </CardTitle>
            <CardDescription>
              Test decoding a specific VIN
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="single-vin">VIN (17 characters)</Label>
              <Input
                id="single-vin"
                value={singleVin}
                onChange={(e) => setSingleVin(e.target.value.toUpperCase())}
                placeholder="Enter VIN..."
                maxLength={17}
              />
            </div>
            <Button 
              onClick={handleSingleVinDecode}
              disabled={isDecodingSingle || !singleVin || singleVin.length !== 17}
              className="w-full"
            >
              {isDecodingSingle ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Decoding...
                </>
              ) : (
                'Decode VIN'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>


      {/* Results Display */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Last Operation Result</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={JSON.stringify(result, null, 2)}
              readOnly
              className="font-mono text-sm"
              rows={10}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}