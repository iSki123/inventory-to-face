import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useChatChannels } from "@/hooks/useChatChannels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Hash, Trophy, Users } from "lucide-react";
import { toast } from "sonner";

export default function Community() {
  const { profile } = useAuth();
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: channels, isLoading: channelsLoading } = useChatChannels();
  const { 
    data: messages, 
    isLoading: messagesLoading, 
    sendMessage, 
    isConnected 
  } = useChatMessages(selectedChannelId);

  // Set default channel to #general
  useEffect(() => {
    if (channels && channels.length > 0 && !selectedChannelId) {
      const generalChannel = channels.find(c => c.name === 'general') || channels[0];
      setSelectedChannelId(generalChannel.id);
    }
  }, [channels, selectedChannelId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChannelId) return;

    try {
      await sendMessage(newMessage, 'text');
      setNewMessage("");
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Failed to send message");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getUserDisplayName = (userId: string, firstName?: string, lastName?: string) => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) return firstName;
    return userId.slice(0, 8);
  };

  const getUserInitials = (firstName?: string, lastName?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) return firstName[0].toUpperCase();
    return "U";
  };

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'owner':
      case 'admin':
        return 'text-red-600 font-semibold';
      case 'manager':
        return 'text-orange-600 font-semibold';
      default:
        return 'text-foreground';
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'owner':
        return <Badge variant="destructive" className="text-xs ml-2">Owner</Badge>;
      case 'admin':
        return <Badge variant="destructive" className="text-xs ml-2">Admin</Badge>;
      case 'manager':
        return <Badge variant="secondary" className="text-xs ml-2 bg-orange-100 text-orange-800">Manager</Badge>;
      default:
        return null;
    }
  };

  if (!profile) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Please log in to access the community.</p>
      </div>
    );
  }

  const selectedChannel = channels?.find(c => c.id === selectedChannelId);

  return (
    <div className="h-full flex">
      {/* Channel Sidebar */}
      <div className="w-64 border-r border-border bg-muted/50">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Community
          </h2>
          <p className="text-sm text-muted-foreground">
            {isConnected ? 'Connected' : 'Connecting...'}
          </p>
        </div>
        
        <ScrollArea className="h-[calc(100vh-12rem)]">
          <div className="p-2">
            {channelsLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-8 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {channels?.map((channel) => (
                  <Button
                    key={channel.id}
                    variant={selectedChannelId === channel.id ? "secondary" : "ghost"}
                    className="w-full justify-start text-left"
                    onClick={() => setSelectedChannelId(channel.id)}
                  >
                    <Hash className="h-4 w-4 mr-2" />
                    <span className="truncate">{channel.display_name}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Channel Header */}
        <div className="p-4 border-b border-border bg-background">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">{selectedChannel?.display_name}</h3>
            {selectedChannel?.name === 'sales-wins' && (
              <Trophy className="h-4 w-4 text-yellow-500" />
            )}
          </div>
          {selectedChannel?.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {selectedChannel.description}
            </p>
          )}
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messagesLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-8 h-8 bg-muted animate-pulse rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted animate-pulse rounded w-24" />
                      <div className="h-4 bg-muted animate-pulse rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages && messages.length > 0 ? (
              messages.map((message) => (
                <div key={message.id} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getUserInitials(message.profiles?.first_name, message.profiles?.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${getRoleColor(message.profiles?.role)}`}>
                        {getUserDisplayName(
                          message.user_id, 
                          message.profiles?.first_name, 
                          message.profiles?.last_name
                        )}
                      </span>
                      {getRoleBadge(message.profiles?.role)}
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.created_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <div className={`text-sm ${
                      message.message_type === 'achievement' 
                        ? 'bg-yellow-50 border-l-4 border-yellow-400 pl-3 py-2 rounded-r' 
                        : ''
                    }`}>
                      {message.message_content}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Hash className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No messages yet. Be the first to start the conversation!</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Input
              placeholder={`Message ${selectedChannel?.display_name}...`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!isConnected}
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={!newMessage.trim() || !isConnected}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}