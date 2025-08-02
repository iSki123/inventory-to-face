import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Filter, MessageSquare, Phone, Mail, Plus, Bot, Clock, User, Star } from "lucide-react";
import { useLeads, Lead } from "@/hooks/useLeads";
import { useLeadMessages, LeadMessage } from "@/hooks/useLeadMessages";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default function Leads() {
  const { leads, loading, updateLead, deleteLead } = useLeads();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  
  const { messages, addMessage, generateAIResponse } = useLeadMessages(selectedLead?.id);

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = searchTerm === "" || 
      lead.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.initial_message.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    const matchesSource = sourceFilter === "all" || lead.source === sourceFilter;
    
    return matchesSearch && matchesStatus && matchesSource;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'interested': return 'bg-green-100 text-green-800';
      case 'qualified': return 'bg-purple-100 text-purple-800';
      case 'sold': return 'bg-emerald-100 text-emerald-800';
      case 'lost': return 'bg-red-100 text-red-800';
      case 'not_interested': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price / 100);
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const handleStatusUpdate = async (leadId: string, newStatus: string) => {
    await updateLead(leadId, { status: newStatus as Lead['status'] });
  };

  const handleSendReply = async () => {
    if (!selectedLead || !replyText.trim()) return;

    await addMessage({
      lead_id: selectedLead.id,
      sender_type: 'agent',
      message_content: replyText,
      is_ai_generated: false,
      generation_cost: 0,
      message_type: 'text',
    });

    setReplyText("");
    
    // Update lead status to 'contacted' if it was 'new'
    if (selectedLead.status === 'new') {
      await updateLead(selectedLead.id, { status: 'contacted' });
    }
  };

  const handleGenerateAIReply = async () => {
    if (!selectedLead) return;

    setIsGeneratingAI(true);
    try {
      // Create conversation history for AI context
      const conversationHistory = messages
        .map(msg => `${msg.sender_type === 'customer' ? 'Customer' : 'Agent'}: ${msg.message_content}`)
        .join('\n');

      const aiResponse = await generateAIResponse(selectedLead.id, conversationHistory);
      
      if (aiResponse) {
        setReplyText(aiResponse.response);
        
        // Optionally auto-send the AI response
        await addMessage({
          lead_id: selectedLead.id,
          sender_type: 'ai',
          message_content: aiResponse.response,
          is_ai_generated: true,
          ai_model: aiResponse.model,
          generation_cost: aiResponse.cost || 1,
          message_type: 'text',
        });

        setReplyText("");
        
        // Update lead status
        if (selectedLead.status === 'new') {
          await updateLead(selectedLead.id, { status: 'contacted' });
        }
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading leads...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Lead Management</h2>
          <p className="text-muted-foreground">
            Manage customer inquiries and follow-ups
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search leads..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="interested">Interested</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="facebook_marketplace">Facebook</SelectItem>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="phone">Phone</SelectItem>
            <SelectItem value="walk_in">Walk-in</SelectItem>
            <SelectItem value="referral">Referral</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lead Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leads.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">New Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {leads.filter(l => l.status === 'new').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Qualified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {leads.filter(l => l.status === 'qualified').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {leads.length > 0 ? Math.round((leads.filter(l => l.status === 'sold').length / leads.length) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leads List */}
      {filteredLeads.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-muted-foreground">
            {leads.length === 0 ? (
              <div>
                <p className="text-lg mb-2">No leads yet</p>
                <p className="text-sm">Leads will appear here when customers inquire about your vehicles</p>
              </div>
            ) : (
              <p>No leads match your current filters</p>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredLeads.map((lead) => (
            <Card key={lead.id} className="cursor-pointer hover:bg-muted/50" 
                  onClick={() => setSelectedLead(lead)}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{lead.customer_name}</h3>
                      <Badge className={getStatusColor(lead.status)}>
                        {lead.status.replace('_', ' ')}
                      </Badge>
                      <Badge className={getPriorityColor(lead.priority)}>
                        {lead.priority}
                      </Badge>
                      {lead.is_qualified && (
                        <Badge variant="outline">
                          <Star className="w-3 h-3 mr-1" />
                          Qualified
                        </Badge>
                      )}
                    </div>
                    
                    {lead.vehicle && (
                      <p className="text-sm text-muted-foreground mb-2">
                        Interested in: {lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model} - {formatPrice(lead.vehicle.price)}
                      </p>
                    )}
                    
                    <p className="text-sm mb-3 line-clamp-2">{lead.initial_message}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {lead.customer_email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          <span>{lead.customer_email}</span>
                        </div>
                      )}
                      {lead.customer_phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          <span>{lead.customer_phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{formatRelativeTime(lead.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        <span>{lead.response_count} responses</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <Select value={lead.status} onValueChange={(value) => handleStatusUpdate(lead.id, value)}>
                      <SelectTrigger className="w-[120px]" onClick={(e) => e.stopPropagation()}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="interested">Interested</SelectItem>
                        <SelectItem value="not_interested">Not Interested</SelectItem>
                        <SelectItem value="follow_up">Follow Up</SelectItem>
                        <SelectItem value="qualified">Qualified</SelectItem>
                        <SelectItem value="sold">Sold</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLead(lead);
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Lead Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedLead?.customer_name} - Lead Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedLead && (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
              {/* Lead Info */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Lead Information</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Status:</span>
                      <Badge className={`ml-2 ${getStatusColor(selectedLead.status)}`}>
                        {selectedLead.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-medium">Priority:</span>
                      <Badge className={`ml-2 ${getPriorityColor(selectedLead.priority)}`}>
                        {selectedLead.priority}
                      </Badge>
                    </div>
                    <div><span className="font-medium">Source:</span> {selectedLead.source}</div>
                    <div><span className="font-medium">Lead Score:</span> {selectedLead.lead_score}/100</div>
                    {selectedLead.customer_email && (
                      <div><span className="font-medium">Email:</span> {selectedLead.customer_email}</div>
                    )}
                    {selectedLead.customer_phone && (
                      <div><span className="font-medium">Phone:</span> {selectedLead.customer_phone}</div>
                    )}
                  </div>
                </div>

                {selectedLead.vehicle && (
                  <div>
                    <h4 className="font-medium mb-2">Vehicle of Interest</h4>
                    <div className="text-sm space-y-1">
                      <div>{selectedLead.vehicle.year} {selectedLead.vehicle.make} {selectedLead.vehicle.model}</div>
                      <div className="font-medium">{formatPrice(selectedLead.vehicle.price)}</div>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-2">Initial Message</h4>
                  <p className="text-sm bg-muted p-3 rounded">{selectedLead.initial_message}</p>
                </div>
              </div>

              {/* Conversation */}
              <div className="flex flex-col h-full">
                <h4 className="font-medium mb-2">Conversation</h4>
                
                <ScrollArea className="flex-1 border rounded p-3 space-y-3">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${
                      message.sender_type === 'customer' ? 'justify-start' : 'justify-end'
                    } mb-3`}>
                      <div className={`max-w-[80%] p-3 rounded-lg ${
                        message.sender_type === 'customer' 
                          ? 'bg-muted' 
                          : message.sender_type === 'ai'
                          ? 'bg-blue-100'
                          : 'bg-primary text-primary-foreground'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {message.sender_type === 'customer' && <User className="h-3 w-3" />}
                          {message.sender_type === 'ai' && <Bot className="h-3 w-3" />}
                          <span className="text-xs font-medium">
                            {message.sender_type === 'customer' ? 'Customer' : 
                             message.sender_type === 'ai' ? 'AI Assistant' : 'You'}
                          </span>
                          <span className="text-xs opacity-70">
                            {formatRelativeTime(message.created_at)}
                          </span>
                        </div>
                        <p className="text-sm">{message.message_content}</p>
                      </div>
                    </div>
                  ))}
                </ScrollArea>

                <Separator className="my-3" />

                {/* Reply Section */}
                <div className="space-y-3">
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleSendReply} disabled={!replyText.trim()}>
                      Send Reply
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleGenerateAIReply}
                      disabled={isGeneratingAI}
                    >
                      <Bot className="mr-2 h-4 w-4" />
                      {isGeneratingAI ? 'Generating...' : 'AI Reply'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}