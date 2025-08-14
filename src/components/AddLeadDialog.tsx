import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVehicles } from "@/hooks/useVehicles";
import { useLeads, Lead } from "@/hooks/useLeads";
import { X } from "lucide-react";

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LeadFormData {
  vehicle_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  initial_message: string;
  source: Lead['source'];
  priority: Lead['priority'];
  notes?: string;
}

export function AddLeadDialog({ open, onOpenChange }: AddLeadDialogProps) {
  const { vehicles } = useVehicles();
  const { addLead } = useLeads();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<LeadFormData>({
    vehicle_id: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    initial_message: "",
    source: "other",
    priority: "medium",
    notes: ""
  });

  const [errors, setErrors] = useState<Partial<Record<keyof LeadFormData, string>>>({});

  const availableVehicles = vehicles.filter(v => v.status === 'available');

  const handleInputChange = (field: keyof LeadFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof LeadFormData, string>> = {};

    if (!formData.customer_name.trim()) {
      newErrors.customer_name = "Customer name is required";
    }

    if (!formData.initial_message.trim()) {
      newErrors.initial_message = "Initial message is required";
    }

    if (formData.customer_email && !isValidEmail(formData.customer_email)) {
      newErrors.customer_email = "Please enter a valid email address";
    }

    if (!formData.customer_email && !formData.customer_phone) {
      newErrors.customer_email = "Either email or phone number is required";
      newErrors.customer_phone = "Either email or phone number is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const leadData = {
        ...formData,
        vehicle_id: formData.vehicle_id || undefined,
        customer_email: formData.customer_email || undefined,
        customer_phone: formData.customer_phone || undefined,
        notes: formData.notes || undefined,
        status: 'new' as Lead['status'] // Set default status for new leads
      };

      const result = await addLead(leadData);
      
      if (result) {
        // Reset form and close dialog
        setFormData({
          vehicle_id: "",
          customer_name: "",
          customer_email: "",
          customer_phone: "",
          initial_message: "",
          source: "other",
          priority: "medium",
          notes: ""
        });
        setErrors({});
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error submitting lead:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price / 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Vehicle Selection */}
          <div className="space-y-2">
            <Label htmlFor="vehicle">Vehicle (Optional)</Label>
            <Select value={formData.vehicle_id} onValueChange={(value) => handleInputChange('vehicle_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a vehicle of interest" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No specific vehicle</SelectItem>
                {availableVehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.year} {vehicle.make} {vehicle.model} - {formatPrice(vehicle.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer Name *</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => handleInputChange('customer_name', e.target.value)}
                placeholder="Enter customer name"
                className={errors.customer_name ? "border-destructive" : ""}
              />
              {errors.customer_name && (
                <p className="text-sm text-destructive">{errors.customer_name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_phone">Phone Number</Label>
              <Input
                id="customer_phone"
                value={formData.customer_phone}
                onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                placeholder="Enter phone number"
                className={errors.customer_phone ? "border-destructive" : ""}
              />
              {errors.customer_phone && (
                <p className="text-sm text-destructive">{errors.customer_phone}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_email">Email Address</Label>
            <Input
              id="customer_email"
              type="email"
              value={formData.customer_email}
              onChange={(e) => handleInputChange('customer_email', e.target.value)}
              placeholder="Enter email address"
              className={errors.customer_email ? "border-destructive" : ""}
            />
            {errors.customer_email && (
              <p className="text-sm text-destructive">{errors.customer_email}</p>
            )}
          </div>

          {/* Lead Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source">Lead Source</Label>
              <Select value={formData.source} onValueChange={(value: Lead['source']) => handleInputChange('source', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="facebook_marketplace">Facebook Marketplace</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="walk_in">Walk-in</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value: Lead['priority']) => handleInputChange('priority', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="initial_message">Initial Message *</Label>
            <Textarea
              id="initial_message"
              value={formData.initial_message}
              onChange={(e) => handleInputChange('initial_message', e.target.value)}
              placeholder="Enter the customer's initial inquiry or message"
              rows={3}
              className={errors.initial_message ? "border-destructive" : ""}
            />
            {errors.initial_message && (
              <p className="text-sm text-destructive">{errors.initial_message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Add any additional notes about this lead"
              rows={2}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding Lead..." : "Add Lead"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}