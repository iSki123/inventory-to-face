import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { VehicleSource } from "@/hooks/useVehicleSources";

interface VehicleSourceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<VehicleSource, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  source?: VehicleSource | null;
  isEditing?: boolean;
}

export function VehicleSourceForm({ open, onOpenChange, onSubmit, source, isEditing }: VehicleSourceFormProps) {
  const [formData, setFormData] = useState<Partial<VehicleSource>>(
    source || {
      dealership_name: '',
      website_url: '',
      scraping_enabled: true,
      scraping_frequency: 24,
    }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.dealership_name || !formData.website_url) {
      return;
    }

    setIsSubmitting(true);
    try {
      const submissionData: Omit<VehicleSource, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
        dealership_name: formData.dealership_name!,
        website_url: formData.website_url!,
        scraping_enabled: formData.scraping_enabled || true,
        scraping_frequency: formData.scraping_frequency || 24,
        octoparse_task_id: formData.octoparse_task_id,
        last_scraped_at: formData.last_scraped_at,
      };
      
      await onSubmit(submissionData);
      onOpenChange(false);
      if (!isEditing) {
        setFormData({
          dealership_name: '',
          website_url: '',
          scraping_enabled: true,
          scraping_frequency: 24,
        });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof VehicleSource, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Vehicle Source' : 'Add Vehicle Source'}</DialogTitle>
          <DialogDescription>Configure a data source for scraping inventory.</DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="dealership_name">Dealership Name *</Label>
            <Input
              id="dealership_name"
              value={formData.dealership_name || ''}
              onChange={(e) => updateField('dealership_name', e.target.value)}
              placeholder="ABC Auto Sales"
              required
            />
          </div>

          <div>
            <Label htmlFor="website_url">Website URL *</Label>
            <Input
              id="website_url"
              type="url"
              value={formData.website_url || ''}
              onChange={(e) => updateField('website_url', e.target.value)}
              placeholder="https://example.com/inventory"
              required
            />
          </div>

          <div>
            <Label htmlFor="scraping_frequency">Scraping Frequency (hours)</Label>
            <Select 
              value={formData.scraping_frequency?.toString()} 
              onValueChange={(value) => updateField('scraping_frequency', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">Every 4 hours</SelectItem>
                <SelectItem value="8">Every 8 hours</SelectItem>
                <SelectItem value="12">Every 12 hours</SelectItem>
                <SelectItem value="24">Daily</SelectItem>
                <SelectItem value="48">Every 2 days</SelectItem>
                <SelectItem value="168">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="scraping_enabled"
              checked={formData.scraping_enabled || false}
              onCheckedChange={(checked) => updateField('scraping_enabled', checked)}
            />
            <Label htmlFor="scraping_enabled">Enable automatic scraping</Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Source' : 'Add Source'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}